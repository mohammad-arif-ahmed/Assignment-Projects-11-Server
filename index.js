const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const { MongoClient, ServerApiVersion } = require("mongodb");
const usersRoutes = require("./routes/usersRoutes");
const verifyJWT = require("./middleware/verifyJWT");
const verifyAdmin = require("./middleware/verifyAdmin");
const verifyCreator = require("./middleware/verifyCreator");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nkerzi4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create Mongo Client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // collections
    const usersCollection = client
      .db("contestHubDB")
      .collection("users");

    const contestsCollection = client
      .db("contestHubDB")
      .collection("contests");

    const paymentsCollection = client
      .db("contestHubDB")
      .collection("payments");

    const submissionsCollection = client
      .db("contestHubDB")
      .collection("submissions");

    // test route
    app.get("/", (req, res) => {
      res.send("ContestHub Server Running");
    });
    // users route
    app.use("/users", usersRoutes(usersCollection));
    // attach usersCollection
    app.use((req, res, next) => {

      req.usersCollection = usersCollection;

      next();

    });
    // admin test route
    app.get(
      "/admin-route",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {

        res.send({
          message: "Welcome Admin",
        });

      }
    );
    // creator test route
    app.get(
      "/creator-route",
      verifyJWT,
      verifyCreator,
      async (req, res) => {

        res.send({
          message: "Welcome Creator",
        });

      }
    );
    // jwt api
    app.post("/jwt", async (req, res) => {

      const user = req.body;

      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
          sameSite: "strict",
        })
        .send({ success: true });

    });
    // private route test
    app.get("/private", verifyJWT, async (req, res) => {

      res.send({
        success: true,
        user: req.decoded,
      });

    });
    console.log("MongoDB Connected Successfully");
  } finally {
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});