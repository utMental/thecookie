const mongoose = require('mongoose');

const processedEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true  // This ensures no duplicate event IDs are stored.
  }
});

// The collection will be called "processedevents" by default.
module.exports = mongoose.model('ProcessedEvent', processedEventSchema);