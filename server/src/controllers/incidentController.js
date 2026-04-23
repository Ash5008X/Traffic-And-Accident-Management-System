const incidentModel = require('../modules/incidentModel');
const fieldUnitModel = require('../modules/fieldUnitModel');
const { filterAndAnnotate } = require('../utils/zoneUtils');
const userModel = require('../modules/userModel');

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
  },

  /**
   * Dashboard stats scoped to a 5km radius around the admin's saved location.
   * Returns: activeCount, resolvedToday, avgResponseTimeMinutes, nearbyIncidents, zoneBreakdown
   */
  async dashboardStats(req, res) {
    try {
      const adminUser = await userModel.findById(req.user.id);
      if (!adminUser || !adminUser.location) {
        return res.status(400).json({ error: 'Admin location not set' });
      }

      const centerLat = adminUser.location.lat;
      const centerLng = adminUser.location.lng;
      const RADIUS_KM = 50;

      // Fetch all non-dismissed incidents
      const allActive = await incidentModel.findAll({ });

      // Filter to 5km radius and annotate with zone
      const nearby = filterAndAnnotate(allActive, centerLat, centerLng, RADIUS_KM);

      const activeIncidents = nearby.filter(inc => !['resolved', 'dismissed'].includes(inc.status));

      // Resolved TODAY within 5km
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const resolvedToday = nearby.filter(inc =>
        inc.status === 'resolved' && inc.resolvedAt && new Date(inc.resolvedAt) >= todayStart
      );

      // Average response time (createdAt → resolvedAt) in minutes for resolved-today
      let avgResponseMinutes = null;
      if (resolvedToday.length > 0) {
        const totalMs = resolvedToday.reduce((sum, inc) => {
          return sum + (new Date(inc.resolvedAt) - new Date(inc.createdAt));
        }, 0);
        avgResponseMinutes = Math.round(totalMs / resolvedToday.length / 60000);
      }

      // Zone breakdown (A-F) for active nearby incidents
      const zoneBreakdown = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
      for (const inc of activeIncidents) {
        if (inc.zone && zoneBreakdown[inc.zone] !== undefined) {
          zoneBreakdown[inc.zone]++;
        }
      }

      const fieldUnits = await fieldUnitModel.findAll();

      res.json({
        centerLat,
        centerLng,
        radiusKm: RADIUS_KM,
        activeCount: activeIncidents.length,
        resolvedTodayCount: resolvedToday.length,
        avgResponseMinutes,
        activeIncidents,
        zoneBreakdown,
        fieldUnits
      });
    } catch (err) {
      console.error('Dashboard stats error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = incidentController;
