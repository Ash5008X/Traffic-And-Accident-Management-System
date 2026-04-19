const express = require('express');
const router = express.Router();
const fieldUnitController = require('../controllers/fieldUnitController');
const auth = require('../middleware/auth');

router.get('/:id', auth, fieldUnitController.getById);
router.patch('/:id/status', auth, fieldUnitController.updateStatus);
router.patch('/:id/arrived', auth, fieldUnitController.markArrived);
router.patch('/:id/location', auth, fieldUnitController.updateLocation);
router.get('/:id/assigned', auth, fieldUnitController.getAssigned);
router.get('/:id/updates', auth, fieldUnitController.getUpdates);

module.exports = router;