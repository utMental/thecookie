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
  console.log(`[/webhook] Stripe webhook received at: ${new Date().toISOString()}`);
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    console.log('[/webhook] Attempting to construct event...');
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log(`[/webhook] Event constructed successfully. Event ID: ${event.id}, Type: ${event.type}`);
  } catch (err) {
    console.error('[/webhook] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Deduplicate
  try {
    console.log(`[/webhook] Checking if event ${event.id} has been processed...`);
    const existing = await ProcessedEvent.findOne({ eventId: event.id });
    if (existing) {
      console.log(`Event ${event.id} already processed; skipping.`);
      return res.status(200).send('Event already processed');
    }
  } catch (dbErr) {
    console.error('Error looking up processed event:', dbErr);
    // Still attempt to process if lookup fails, but log it.
    // Depending on policy, you might choose to return 500 here.
    return res.status(500).send('Internal Server Error');
  }

  // Handle checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object; // session is a CheckoutSession object
    const metadata = session.metadata;

    // Construct the entry for the leaderboard service
    const entryData = {
      name: metadata.name,
      amount: session.amount_total / 100, // amount_total is in cents
      stripeCustomerID: metadata.stripeCustomerID,
      locationLabel: metadata.locationLabel,
      message: metadata.message || ''
    };
    console.log('[/webhook] Constructed entryData:', JSON.stringify(entryData, null, 2));

    // Add position if lat and lng are present
    if (metadata.lat && metadata.lng) {
      entryData.position = {
        type: 'Point',
        coordinates: [parseFloat(metadata.lng), parseFloat(metadata.lat)] // GeoJSON is [longitude, latitude]
      };
    }
    try {
      console.log('[/webhook] Attempting to add entry to leaderboard...');
      await leaderboardService.addEntry(entryData);
      console.log(`[/webhook] ✅ Payment processed and entry added/updated for: ${entryData.name}, Amount: £${entryData.amount}`);
    } catch (serviceErr) {
      console.error('[/webhook] Error calling leaderboardService.addEntry:', serviceErr);
      // Decide if you should return a 500 error to Stripe here.
      // Generally, if you can't process, Stripe will retry.
    }
  } else {
    console.log(`[/webhook] Unhandled event type: ${event.type}`);
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
    check('amount').isFloat({ min: 1, max: 999999.99 }).withMessage('Amount must be between 1 and 999,999.99'),
    check('locationLabel').trim().notEmpty().withMessage('Location is required'), // Assuming you get this from frontend
    check('lat').isFloat().withMessage('Latitude is required'),
    check('lng').isFloat().withMessage('Longitude is required'),
    check('message')
      .optional({ checkFalsy: true })
      .isString()
      .isLength({ max: 70 })
      .withMessage('Message must be under 70 characters'),
    
  ],
  async (req, res) => {
    const errors = validationResult(req);
    console.log('[/api/submit] Received request. Body:', JSON.stringify(req.body, null, 2));
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Destructure all expected fields, including location data
    const { name, amount, locationLabel, lat, lng, message } = req.body;

    try {
      // Create a Stripe customer without email.
      // Stripe will assign its own ID. You can pass a name if desired.
      // If you still want to prevent duplicate entries by the same person without email,
      // you'd need a different strategy (e.g., based on IP + name, or a user account system).
      // For now, we'll create a new customer for each submission for simplicity if email is removed.
      console.log('[/api/submit] Creating Stripe customer with name:', name);
      const customer = await stripe.customers.create({ name });

      // Create Stripe Checkout session
      console.log('[/api/submit] Creating Stripe Checkout session with metadata:', JSON.stringify({ name, amount: String(amount), stripeCustomerID: customer.id, locationLabel, lat: String(lat), lng: String(lng), message: message || '' }, null, 2));
      const session = await stripe.checkout.sessions.create({
        customer: customer.id, // Associate session with the created customer
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
        metadata: {
          name,
          amount: String(amount), // Stripe metadata values must be strings
          stripeCustomerID: customer.id,
          locationLabel,
          lat: String(lat),
          lng: String(lng),
          message: message || ''
        }
      });

      console.log('[/api/submit] Stripe Checkout session created successfully. Session ID:', session.id);
      res.json({ url: session.url });
    } catch (err) {
      console.error('[/api/submit] Error during Stripe operations:', err);
      res.status(500).json({ message: 'Error processing payment submission' });
    }
  }
);

console.log(`Backend server running on port ${port}`);
app.listen(port);
