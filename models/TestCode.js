const mongoose = require('mongoose');

const testCodeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        default: 'global'
    },
    code: {
        type: String,
        required: true,
    }
}, {
    timestamps: true
});

const TestCode = mongoose.model('TestCode', testCodeSchema);

module.exports = TestCode; 