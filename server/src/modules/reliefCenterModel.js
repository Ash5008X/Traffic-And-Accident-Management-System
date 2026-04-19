const { getDB } = require('../config/db');
const { ObjectId } = require('mongodb');

const COLLECTION = 'relief_centers';

const reliefCenterModel = {
  async create(data) {
    const db = getDB();
    const doc = {
      name: data.name,
      location: data.location || { lat: 0, lng: 0 },
      units: data.units || [],
      status: 'on_duty'
    };
    const result = await db.collection(COLLECTION).insertOne(doc);
    return { ...doc, _id: result.insertedId };
  },

  async findById(id) {
    const db = getDB();
    return db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
  },

  async findAll() {
    const db = getDB();
    return db.collection(COLLECTION).find({}).toArray();
  },

  async updateStatus(id, status) {
    const db = getDB();
    return db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { status } },
      { returnDocument: 'after' }
    );
  },

  async addUnit(id, unitId) {
    const db = getDB();
    return db.collection(COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $addToSet: { units: new ObjectId(unitId) } },
      { returnDocument: 'after' }
    );
  },

  async findByAdminId(adminId) {
    const db = getDB();
    return db.collection(COLLECTION).findOne({ adminId: new ObjectId(adminId) });
  }
};

module.exports = reliefCenterModel;
