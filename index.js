
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // Will be used later for authentication
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Enable CORS for client-server communication
app.use(express.json()); // Enable parsing of JSON body

// 1. Construct the MongoDB Connection URI using environment variables
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nkerzi4.mongodb.net/?appName=Cluster0`;

// 2. Create a MongoClient with Server API settings
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // 3. Connect the client to the MongoDB server
        await client.connect();
        console.log("Pinged your deployment. Connected to MongoDB!");

        // 4. Define Database and Collections
        const db = client.db("contestHubDB");
        const usersCollection = db.collection("users");
        const contestsCollection = db.collection("contests");
        const paymentsCollection = db.collection("payments");
        const submissionsCollection = db.collection("submissions");

        // =========================================================
        //                      API ENDPOINTS
        // =========================================================

        // Basic Test Route
        app.get('/test', (req, res) => {
            res.send({ message: 'ContestHub API Test Endpoint is working!' });
        });

        // Note: All other core APIs (JWT, User, Contest, Payment, etc.) will be implemented here later.
        // --- JWT Token Generation API ---
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            // JWT_SECRET is loaded from .env
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
            // Sending the token in the response
            res.send({ token });
        });
        // --- User Related APIs (Registration/Login) ---
app.post('/users', async (req, res) => {
    const user = req.body;
    
    // Check if the user already exists in the database
    const query = { email: user.email };
    const existingUser = await usersCollection.findOne(query);

    if (existingUser) {
        // If user exists, don't insert again, just confirm
        return res.send({ message: 'User already exists', insertedId: null });
    }

    // Default role for new users is 'Normal User'
    const userToInsert = { 
        ...user, 
        role: 'User', 
        createdAt: new Date() 
    };

    const result = await usersCollection.insertOne(userToInsert);
    res.send(result);
});

// --- API to get a single user's role (will be needed for dashboard access)
app.get('/users/:email', async (req, res) => {
    const email = req.params.email;
    const query = { email: email };
    const user = await usersCollection.findOne(query);
    res.send(user);
});

    } catch (error) {
        console.error("MongoDB Connection Error:", error);
        // Optional: gracefully shut down the app if DB connection fails
        // process.exit(1);
    }
    // We keep the client connection open here to serve requests
}
run().catch(console.dir);

// 5. Root Route (Sanity Check)
app.get('/', (req, res) => {
    res.send('ContestHub Server is running...');
});

// 6. Start the Express Server
app.listen(port, () => {
    console.log(`ContestHub Server is running on port ${port}`);
});