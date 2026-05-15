const express = require("express");
const { ObjectId } = require("mongodb");

const router = express.Router();

const paymentsRoutes = (
  paymentsCollection,
  contestsCollection,
  verifyJWT
) => {

  // create payment intent
  router.post(
    "/create-payment-intent",
    verifyJWT,
    async (req, res) => {

      try {

        const { price } = req.body;

        const amount = parseInt(price * 100);

        const stripe = require("stripe")(
          process.env.STRIPE_SECRET_KEY
        );

        const paymentIntent =
          await stripe.paymentIntents.create({
            amount,
            currency: "usd",
            payment_method_types: ["card"],
          });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );

  // save payment and register contest
  router.post(
    "/",
    verifyJWT,
    async (req, res) => {

      try {

        const payment = req.body;

        payment.paidAt = new Date();

        const paymentResult =
          await paymentsCollection.insertOne(payment);

        // increase participant count
        const contestId = payment.contestId;

        const query = {
          _id: new ObjectId(contestId),
        };

        const updateDoc = {
          $inc: {
            participantsCount: 1,
          },
        };

        await contestsCollection.updateOne(
          query,
          updateDoc
        );

        res.send(paymentResult);

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );

  // my participated contests
  router.get(
    "/my-contests",
    verifyJWT,
    async (req, res) => {

      try {

        const email = req.query.email;

        const query = {
          participantEmail: email,
        };

        const result = await paymentsCollection
          .find(query)
          .sort({ paidAt: -1 })
          .toArray();

        res.send(result);

      } catch (error) {

        res.status(500).send({
          message: error.message,
        });

      }

    }
  );

  return router;
};

module.exports = paymentsRoutes;