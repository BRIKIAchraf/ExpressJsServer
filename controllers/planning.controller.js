const mongoose = require('mongoose');
const Planning = require('../models/planning.model');
const Jour = require('../models/jour.model');
const Employe = require('../models/employe.model');

/**
 * Creates a new planning along with associated jours and employees.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<void>}
 */
exports.createPlanningWithJoursAndEmployees = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { intitule, sessions, employees } = req.body;

    // Validate request body
    if (!intitule || !sessions || !employees) {
      throw new Error('Invalid input data');
    }

    // Create the planning
    const newPlanning = await Planning.create([{ intitule, employees }], { session });

    // Create jours associated with the planning
    const joursCreated = await Jour.create(
      sessions.map((session) => ({
        h_entree: session.h_entree,
        h_sortie: session.h_sortie,
        id_planning: newPlanning[0]._id
      })),
      { session }
    );

    // Assign the planning to the employees
    await Employe.updateMany(
      { _id: { $in: employees } },
      { id_planning: newPlanning[0]._id },
      { session }
    );

    await session.commitTransaction();
    res.status(201).json({
      message: 'Planning, jours, and employees created successfully!',
      planning: newPlanning,
      jours: joursCreated
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

/**
 * Retrieves all plannings with pagination and filtering support, along with associated jours and employees.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<void>}
 */
exports.getAllPlannings = async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  try {
    // Fetch plannings with pagination
    const plannings = await Planning.find({ isDeleted: false })
      .populate('employees')
      .skip(skip)
      .limit(limit);

    // Fetch associated jours for each planning
    const planningWithJours = await Promise.all(plannings.map(async (planning) => {
      const jours = await Jour.find({ id_planning: planning._id });
      return { ...planning.toObject(), jours };
    }));

    res.status(200).json(planningWithJours);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Retrieves a planning by its ID, along with associated jours and employees.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<void>}
 */
exports.getPlanningById = async (req, res) => {
  try {
    // Fetch planning by ID
    const planning = await Planning.findOne({ _id: req.params.id, isDeleted: false }).populate('employees');
    if (!planning) {
      return res.status(404).json({ message: 'Planning not found' });
    }

    // Fetch associated jours for the planning
    const jours = await Jour.find({ id_planning: planning._id });

    res.status(200).json({ ...planning.toObject(), jours });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Updates a planning by its ID.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<void>}
 */
exports.updatePlanning = async (req, res) => {
  try {
    const planning = await Planning.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('employees');
    if (!planning) {
      return res.status(404).json({ message: 'Planning not found' });
    }
    res.status(200).json(planning);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Deletes a planning by its ID (soft delete).
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<void>}
 */
exports.deletePlanning = async (req, res) => {
  try {
    const planning = await Planning.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
    if (!planning) {
      return res.status(404).json({ message: 'Planning not found' });
    }
    res.status(200).json({ message: 'Planning deleted', planning });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
