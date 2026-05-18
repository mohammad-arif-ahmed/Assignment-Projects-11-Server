const express = require("express");
const { ObjectId } = require("mongodb");

const router = express.Router();

const usersRoutes = (
  usersCollection,
  verifyJWT,
  verifyAdmin
) => {

  // save user
  router.post("/", async (req, res) => {

    try {

      const user = req.body;

      const query = {
        email: user.email,
      };

      const existingUser =
        await usersCollection.findOne(query);

      if (existingUser) {

        return res.send({
          message: "User already exists",
          inserted: false,
        });

      }

      user.role = "user";

      user.createdAt = new Date();

      const result =
        await usersCollection.insertOne(user);

      res.send(result);

    } catch (error) {

      res.status(500).send({
        message: error.message,
      });

    }

  });

  // get all users
  router.get(
    "/",
    verifyJWT,
    verifyAdmin,
    async (req, res) => {

      const result =
        await usersCollection
          .find()
          .toArray();

      res.send(result);

    }
  );
  // get user role
  router.get(
    "/role/:email",
    verifyJWT,
    async (req, res) => {

      try {

        const email = req.params.email;

        const query = {
          email,
        };

        const user =
          await usersCollection.findOne(query);

        res.send({
          role: user?.role,
        });

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );

  // update role
  router.patch(
    "/role/:id",
    verifyJWT,
    verifyAdmin,
    async (req, res) => {

      const id = req.params.id;

      const role = req.body.role;

      const query = {
        _id: new ObjectId(id),
      };

      const updateDoc = {
        $set: {
          role,
        },
      };

      const result =
        await usersCollection.updateOne(
          query,
          updateDoc
        );

      res.send(result);

    }
  );

  // leaderboard
  router.get(
    "/leaderboard",
    async (req, res) => {

      const result =
        await usersCollection
          .find()
          .sort({ wins: -1 })
          .limit(10)
          .toArray();

      res.send(result);

    }
  );

  return router;

};

module.exports = usersRoutes;