const mongoose = require('mongoose');

// Define the schema for a leaderboard entry
const entrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  stripeCustomerID: { type: String, required: true, unique: true },
  link: { type: String, default: "" },
  message: { type: String, default: "" }
});

// Create the Mongoose model
const Entry = mongoose.model('Entry', entrySchema);

// Get the leaderboard sorted by amount in descending order
async function getLeaderboard() {
  try {
    const entries = await Entry.find().sort({ amount: -1 }).lean();
    return entries;
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    return [];
  }
}

// Add a new entry or top-up an existing entry
async function addEntry(entry) {
  try {
    const existing = await Entry.findOne({ stripeCustomerID: entry.stripeCustomerID });
    if (existing) {
      // Update existing entry's amount (top-up)
      existing.amount += entry.amount;
      // Also update the link if a new one is provided (optional)
      if (entry.link) {
        existing.link = entry.link;
      }
      await existing.save();
    } else {
      // Create a new entry if one does not exist
      await Entry.create(entry);
    }
  } catch (err) {
    console.error('Error adding entry:', err);
  }
}

module.exports = {
  getLeaderboard,
  addEntry,
};