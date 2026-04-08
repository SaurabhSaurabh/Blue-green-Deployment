const express = require('express');
const router = express.Router();
const User = require('../models/user');

// Create a new user
router.post('/', async (req, res) => {
  try {
    // Validate interests and languages
    const interests = req.body.interests || [];
    const knownLanguages = req.body.knownLanguages || [];
    
    // Filter out empty strings
    const validInterests = interests.filter(item => item && item.trim().length > 0);
    const validLanguages = knownLanguages.filter(item => item && item.trim().length > 0);
    
    // Check if at least one interest and language provided
    if (validInterests.length === 0 || validLanguages.length === 0) {
      return res.status(400).json({ message: 'Please add at least one interest and language' });
    }
    
    // Update the request body with filtered values
    const userData = {
      ...req.body,
      interests: validInterests,
      knownLanguages: validLanguages
    };
    
    const newUser = new User(userData);
    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get user count (for monitoring)
router.get('/count', async (req, res) => {
  try {
    const count = await User.countDocuments();
    const basicCount = await User.countDocuments({ registeredFrom: 'basic' });
    const enhancedCount = await User.countDocuments({ registeredFrom: 'enhanced' });
    
    res.status(200).json({
      total: count,
      basicUI: basicCount,
      enhancedUI: enhancedCount
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;