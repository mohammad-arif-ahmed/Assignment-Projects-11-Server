
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
        // 1. JWT Token Verification Middleware
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access: No token provided' });
            }
            const token = req.headers.authorization.split(' ')[1];

            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access: Invalid token' });
                }
                req.decoded = decoded;
                next();
            });
        };

        // 2. Verify Admin Middleware (Requires verifyToken first)
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);

            const isAdmin = user?.role === 'Admin';

            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access: Not an Admin' });
            }
            next();
        };

        // 3. Verify Creator Middleware (Requires verifyToken first)
        const verifyCreator = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);

            const isCreator = user?.role === 'Creator';

            if (!isCreator) {
                return res.status(403).send({ message: 'forbidden access: Not a Contest Creator' });
            }
            next();
        };

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
        // --- JWT Logout API (New) ---
        app.post('/logout', (req, res) => {
            const user = req.body;
            console.log('User logged out', user);
            res.send({ success: true, message: "Logged out successfully" });
        });

        // --- User Role Check API (New Secured Routes) ---
        app.get('/users/admin/:email', verifyToken, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            res.send({ admin: true });
        });

        app.get('/users/creator/:email', verifyToken, verifyCreator, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            res.send({ creator: true });
        });
        // --- Contest Creator APIs (Commit 4) ---

        // 1. Add a New Contest (Protected by Creator Role)
        app.post('/contests', verifyToken, verifyCreator, async (req, res) => {
            const contest = req.body;

            // Set default status to 'Pending' upon creation
            const contestToInsert = {
                ...contest,
                status: 'Pending',
                participationCount: 0, // Initial count
                creator: req.decoded.email, // Store creator's email for verification/management
                createdAt: new Date(),
            };

            const result = await contestsCollection.insertOne(contestToInsert);
            res.send(result);
        });

        // 2. Get All Contests created by the current Creator
        app.get('/contests/creator', verifyToken, verifyCreator, async (req, res) => {
            const creatorEmail = req.decoded.email;
            const query = { creator: creatorEmail };

            const result = await contestsCollection.find(query).toArray();
            res.send(result);
        });


        // --- Public Contest APIs (Commit 4) ---

        // 3. Get Contest Details by ID (Accessible by everyone, but participation restricted)
        app.get('/contests/:id', async (req, res) => {
            const id = req.params.id;
            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: 'Invalid Contest ID' });
            }
            const query = { _id: new ObjectId(id) };

            const contest = await contestsCollection.findOne(query);

            if (!contest) {
                return res.status(404).send({ message: 'Contest not found' });
            }
            res.send(contest);
        });

        // 4. Get Popular Contests (Sorted by highest participation count)
        app.get('/popular-contests', async (req, res) => {
            // Only fetch Accepted contests and sort by participationCount descending
            const query = { status: 'Accepted' };
            const result = await contestsCollection.find(query)
                .sort({ participationCount: -1 }) // Sort descending
                .limit(5) // Show only 5 contests as required
                .toArray();

            res.send(result);
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