const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');
const teamModel = require('../modules/teamModel');
const userModel = require('../modules/userModel');

const teamController = {
  async getAll(req, res) {
    try {
      const teams = await teamModel.findAll();
      res.json(teams);
    } catch (err) {
      console.error('Get teams error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getByAdmin(req, res) {
    try {
      const teams = await teamModel.findByAdminId(req.user.id);
      res.json(teams);
    } catch (err) {
      console.error('Get admin teams error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async create(req, res) {
    try {
      const { name, zone } = req.body;
      if (!name || !zone) {
        return res.status(400).json({ error: 'Name and zone are required' });
      }
      const team = await teamModel.create({
        name,
        zone,
        adminId: req.user.id,
        members: []
      });
      res.status(201).json(team);
    } catch (err) {
      console.error('Create team error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async deleteTeam(req, res) {
    try {
      const db = getDB();
      const result = await db.collection('teams').deleteOne({ _id: new ObjectId(req.params.id) });
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }
      res.json({ success: true });
    } catch (err) {
      console.error('Delete team error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async addMembers(req, res) {
    try {
      const { memberIds } = req.body;
      const db = getDB();
      const objectIds = memberIds.map(id => new ObjectId(id));
      const result = await db.collection('teams').findOneAndUpdate(
        { _id: new ObjectId(req.params.id) },
        { $addToSet: { members: { $each: objectIds } }, $set: { updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      if (!result) return res.status(404).json({ error: 'Team not found' });
      res.json(result);
    } catch (err) {
      console.error('Add members error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async removeMember(req, res) {
    try {
      const { memberId } = req.body;
      const result = await teamModel.removeMember(req.params.id, memberId);
      if (!result) return res.status(404).json({ error: 'Team not found' });
      res.json(result);
    } catch (err) {
      console.error('Remove member error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getUnassignedFieldUnits(req, res) {
    try {
      const db = getDB();
      // Get all teams and collect member IDs
      const teams = await db.collection('teams').find({}).toArray();
      const assignedIds = new Set();
      teams.forEach(t => {
        (t.members || []).forEach(m => assignedIds.add(m.toString()));
      });

      // Get all field_unit users
      const fieldUsers = await db.collection('users').find({ role: 'field_unit' }).toArray();
      
      // Filter out assigned ones
      const unassigned = fieldUsers
        .filter(u => !assignedIds.has(u._id.toString()))
        .map(u => ({ _id: u._id, name: u.name, email: u.email, role: u.role }));

      res.json(unassigned);
    } catch (err) {
      console.error('Get unassigned error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },

  async getTeamDetails(req, res) {
    try {
      const db = getDB();
      const team = await db.collection('teams').findOne({ _id: new ObjectId(req.params.id) });
      if (!team) return res.status(404).json({ error: 'Team not found' });

      // Populate member details
      let members = [];
      if (team.members && team.members.length > 0) {
        members = await db.collection('users').find({
          _id: { $in: team.members.map(id => new ObjectId(id)) }
        }).project({ password: 0 }).toArray();
      }

      res.json({ ...team, memberDetails: members });
    } catch (err) {
      console.error('Get team details error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = teamController;
