const incidentModel = require('../models/incidentModel');
const fieldUnitModel = require('../models/fieldUnitModel');

const incidentController = {
  async create(req, res) {
    try {
      const incident = await incidentModel.create({
        ...req.body,
        reportedBy: req.user.id
      });
      // Emit socket event if io is available
      if (req.app.get('io')) {
        req.app.get('io').emit('incident:new', incident);
      }
      res.status(201).json(incident);
    } catch (err) {
      console.error('Create incident error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getAll(req, res) {
    try {
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      if (req.query.severity) filter.severity = req.query.severity;
      if (req.query.reportedBy === 'me') filter.reportedBy = req.user.id;
      if (req.query.reportedBy && req.query.reportedBy !== 'me') filter.reportedBy = req.query.reportedBy;
      const incidents = await incidentModel.findAll(filter);
      res.json(incidents);
    } catch (err) {
      console.error('Get incidents error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getById(req, res) {
    try {
      const incident = await incidentModel.findById(req.params.id);
      if (!incident) return res.status(404).json({ error: 'Incident not found' });
      res.json(incident);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },

  async updateStatus(req, res) {
    try {
      const { status } = req.body;
      const incident = await incidentModel.updateStatus(req.params.id, status);
      if (!incident) return res.status(404).json({ error: 'Incident not found' });

      // If resolved, clear the field unit
      if (status === 'resolved' && incident.assignedUnit) {
        await fieldUnitModel.clearIncident(incident.assignedUnit.toString());
      }

      if (req.app.get('io')) {
        req.app.get('io').emit('incident:updated', incident);
      }
      res.json(incident);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },

  async accept(req, res) {
    try {
      const { unitId } = req.body;
      const incident = await incidentModel.assignUnit(req.params.id, unitId, req.body.reliefCenterId);
      if (!incident) return res.status(404).json({ error: 'Incident not found' });

      await fieldUnitModel.assignToIncident(unitId, req.params.id);

      if (req.app.get('io')) {
        req.app.get('io').emit('incident:updated', incident);
        req.app.get('io').emit('unit:statusChanged', { unitId, status: 'en_route' });
      }
      res.json(incident);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },

  async dismiss(req, res) {
    try {
      const incident = await incidentModel.dismiss(req.params.id);
      if (!incident) return res.status(404).json({ error: 'Incident not found' });
      if (req.app.get('io')) {
        req.app.get('io').emit('incident:updated', incident);
      }
      res.json(incident);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },

  async addChat(req, res) {
    try {
      const { message, senderRole, senderId } = req.body;
      const incident = await incidentModel.addChat(req.params.id, {
        message,
        senderRole: senderRole || req.user.role,
        senderId: senderId || req.user.id
      });
      if (!incident) return res.status(404).json({ error: 'Incident not found' });
      if (req.app.get('io')) {
        req.app.get('io').to(`incident:${req.params.id}`).emit('chat:message', {
          incidentId: req.params.id,
          message,
          senderRole: senderRole || req.user.role,
          senderId: senderId || req.user.id,
          senderName: req.user.name,
          timestamp: new Date()
        });
      }
      res.json(incident);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },

  async addAction(req, res) {
    try {
      const incident = await incidentModel.addAction(req.params.id, {
        ...req.body,
        performedBy: req.user.id
      });
      if (!incident) return res.status(404).json({ error: 'Incident not found' });
      if (req.app.get('io')) {
        req.app.get('io').emit('incident:updated', incident);
      }
      res.json(incident);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },

  async backupRequest(req, res) {
    try {
      const incident = await incidentModel.addAction(req.params.id, {
        type: 'backup_request',
        performedBy: req.user.id,
        details: req.body.details || 'Backup requested'
      });
      if (req.app.get('io')) {
        req.app.get('io').emit('incident:updated', incident);
      }
      res.json({ success: true, message: 'Backup request sent' });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },

  async nearby(req, res) {
    try {
      const { lat, lng, radius } = req.query;
      const incidents = await incidentModel.findNearby(
        parseFloat(lat), parseFloat(lng), parseFloat(radius) || 10
      );
      res.json(incidents);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getStats(req, res) {
    try {
      const stats = await incidentModel.getStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getHeatmap(req, res) {
    try {
      const data = await incidentModel.getHeatmap();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  },

  async requestAssignment(req, res) {
    try {
      const incident = await incidentModel.addAction(req.params.id, {
        type: 'assignment_request',
        performedBy: req.user.id,
        details: 'Field unit requested assignment'
      });
      if (req.app.get('io')) {
        req.app.get('io').emit('incident:updated', incident);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = incidentController;
