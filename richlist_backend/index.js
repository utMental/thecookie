const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const Stripe = require('stripe');
const mongoose = require('mongoose');
require('dotenv').config();
const leaderboardService = require('./leaderboardService');
const { check, validationResult } = require('express-validator');
const mongoSanitize = require('express-mongo-sanitize');
const ProcessedEvent = require('./processedEvent');

const app = express();

app.set('trust proxy', 2);

const port = process.env.PORT || 5000;
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Stripe webhook endpoint (raw body required)
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('Stripe webhook received:', new Date().toISOString());
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Deduplicate
  try {
    const existing = await ProcessedEvent.findOne({ eventId: event.id });
    if (existing) {
      console.log(`Event ${event.id} already processed; skipping.`);
      return res.status(200).send('Event already processed');
    }
  } catch (dbErr) {
    console.error('Error looking up processed event:', dbErr);
    return res.status(500).send('Internal Server Error');
  }

  // Handle checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await leaderboardService.addEntry({
      name: session.metadata.name,
      amount: session.amount_total / 100,
      stripeCustomerID: session.metadata.stripeCustomerID,
      link: session.metadata.link || '',
      message: session.metadata.message || ''
    });
    console.log(`✅ Payment received: £${session.amount_total / 100} from ${session.metadata.name}`);
  } else {
    console.log(`Unhandled event type: ${event.type}`);
  }

  // Mark as processed
  try {
    await ProcessedEvent.create({ eventId: event.id });
  } catch (err) {
    console.error('Failed to record processed event:', err);
  }

  return res.status(200).send('Event received');
});

// Security headers + strict CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

// HTTP request logging
app.use(morgan('combined'));

// CORS (only your frontend + localhost)
const allowedOrigins = ['https://theinternetrichlist.com', 'https://www.theinternetrichlist.com', 'http://localhost:3000'];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!allowedOrigins.includes(origin)) {
      return cb(new Error(`CORS blocked: ${origin}`), false);
    }
    return cb(null, true);
  }
}));

// Global rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests; try again later.'
}));

// JSON parser for all non‑webhook routes
app.use(express.json());

// Clone req.query so it can be sanitized
app.use((req, res, next) => {
  req.query = { ...req.query };
  next();
});

// Sanitize against NoSQL injection in query, body, params, headers
app.use((req, res, next) => {
  req.query   = mongoSanitize.sanitize(req.query);
  req.body    = mongoSanitize.sanitize(req.body);
  req.params  = mongoSanitize.sanitize(req.params);
  req.headers = mongoSanitize.sanitize(req.headers);
  next();
});

// GET /api/leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const list = await leaderboardService.getLeaderboard();
    res.json(list);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ message: 'Error fetching leaderboard' });
  }
});

// POST /api/submit with its own rate limiter + validation
app.post(
  '/api/submit',
  rateLimit({ windowMs: 60 * 1000, max: 10, message: 'Too many submissions; try again later.' }),
  [
    check('name').trim().notEmpty().withMessage('Name is required'),
    check('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    check('amount').isFloat({ min: 1, max: 999999.99 }).withMessage('Amount must be between 1 and 999,999.99'),
    check('link')
      .optional({ checkFalsy: true })
      .isURL({ protocols: ['http','https'], require_protocol: true })
      .withMessage('Link must start with http:// or https://'),
    check('message')
      .optional({ checkFalsy: true })
      .isString()
      .isLength({ max: 70 })
      .withMessage('Message must be under 70 characters'),
    
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, amount, email, link, message } = req.body;

    try {
      // Lookup or create Stripe customer
      let customer;
      const existing = await stripe.customers.list({ email, limit: 1 });
      if (existing.data.length > 0) {
        customer = existing.data[0];
      } else {
        customer = await stripe.customers.create({ email, name });
      }

      // Create Stripe Checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'gbp',
            product_data: { name: `Rich List Entry – ${name}` },
            unit_amount: Math.round(amount * 100)
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: process.env.FRONTEND_SUCCESS_URL,
        cancel_url: process.env.FRONTEND_CANCEL_URL,
        metadata: { name, amount, stripeCustomerID: customer.id, link: link || '', message: message || '' }
      });

      res.json({ url: session.url });
    } catch (err) {
      console.error('Payment error:', err);
      res.status(500).json({ message: 'Payment error' });
    }
  }
);

console.log(`Backend server running on port ${port}`);
app.listen(port);
