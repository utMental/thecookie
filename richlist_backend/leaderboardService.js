const mongoose = require('mongoose');

// Define the schema for a leaderboard entry
const entrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  message: { type: String, default: "" },
  locationLabel: { type: String, required: true },
  position: { type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], index: '2dsphere' }},
  createdAt: { type: Date, default: Date.now },
  stripeCustomerID: { type: String, required: true, unique: true },
});

// Create the Mongoose model
const Entry = mongoose.model('Entry', entrySchema);

// Get the leaderboard sorted by creation date in descending order (newest first)
async function getLeaderboard() {
  try {
    const entries = await Entry.find()
      .sort({ createdAt: -1 }) // Sort by createdAt, newest first
      .lean() // Use .lean() for faster queries when not needing Mongoose documents
      .exec();

    // Map entries to include lat and lng at the top level
    return entries.map(entry => ({
      ...entry,
      lat: entry.position && entry.position.coordinates ? entry.position.coordinates[1] : undefined,
      lng: entry.position && entry.position.coordinates ? entry.position.coordinates[0] : undefined,
    }));
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
      if (entry.message) { // Allow message update on top-up
        existing.message = entry.message;
      }
      // Decide if name, locationLabel, position can be updated on top-up.
      // For simplicity, we're not updating them here.
      await existing.save();
    } else {
      // Create a new entry if one does not exist
      // Ensure all required fields are present in 'entry'
      // 'entry.position' will be undefined if lat/lng were not in metadata,
      // but the schema has a default for 'position.type', and 'coordinates' can be empty if not a 2dsphere query target.
      // However, for consistency, ensure 'position' is always structured if lat/lng are provided.
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