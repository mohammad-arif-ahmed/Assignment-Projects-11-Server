
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // Will be used later for authentication
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config(); // Load environment variables from .env file
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    // 🔑 IMPORTANT: Allow your client URL
    origin: ['http://localhost:5173'],
    credentials: true, // This allows cookies/headers like JWT to be sent
}));
app.use(express.json());

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
let usersCollection;
let contestsCollection;
let paymentsCollection;
let submissionsCollection;

async function run() {
    try {
        // 3. Connect the client to the MongoDB server
        await client.connect();
        console.log("Pinged your deployment. Connected to MongoDB!");

        // 4. Define Database and Collections
        const db = client.db("contestHubDB");
        usersCollection = db.collection("users");
        contestsCollection = db.collection("contests");
        paymentsCollection = db.collection("payments");
        submissionsCollection = db.collection("submissions");
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
        app.get('/contests/popular', async (req, res) => {
            try {
                const result = await contestCollection
                    .find({ status: 'approved' })
                    .sort({ participantsCount: -1 })
                    .limit(4)
                    .toArray();

                res.send(result);
            } catch (error) {
                console.error('Error fetching popular contests:', error);
                res.status(500).send({ message: 'Failed to fetch popular contests' });
            }
        });
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
        // --- Creator Edit Contest API (Pending Status check) ---
        app.patch('/contests/creator/edit/:id', verifyToken, verifyCreator, async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;
            const creatorEmail = req.decoded.email;

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: 'Invalid Contest ID' });
            }

            // Only allow update if status is 'Pending' AND the creator email matches
            const filter = {
                _id: new ObjectId(id),
                creator: creatorEmail,
                status: 'Pending' // Crucial check: only pending contests can be edited
            };

            // Prepare the update document
            const updateDoc = {
                $set: updatedData,
            };

            const result = await contestsCollection.updateOne(filter, updateDoc);

            if (result.matchedCount === 0) {
                return res.status(403).send({ message: 'Forbidden: Contest either Confirmed/Rejected or does not belong to this creator.' });
            }
            res.send(result);
        });

        // --- Creator Delete Contest API (Pending Status check) ---
        app.delete('/contests/creator/:id', verifyToken, verifyCreator, async (req, res) => {
            const id = req.params.id;
            const creatorEmail = req.decoded.email;

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: 'Invalid Contest ID' });
            }

            // Only allow deletion if status is 'Pending' AND the creator email matches
            const query = {
                _id: new ObjectId(id),
                creator: creatorEmail,
                status: 'Pending' // Crucial check: only pending contests can be deleted
            };

            const result = await contestsCollection.deleteOne(query);

            if (result.deletedCount === 0) {
                return res.status(403).send({ message: 'Forbidden: Contest either Confirmed/Rejected or does not belong to this creator.' });
            }
            res.send(result);
        });


        // --- Public Contest APIs (Commit 4) ---

        app.get('/contests', async (req, res) => {
            const { search, type, page, size } = req.query;
            let query = { status: 'Accepted' }; // Base query: only show approved contests

            // Handle Pagination
            const pageNum = parseInt(page) || 0; // Current page number (default 0)
            const pageSize = parseInt(size) || 10; // Number of items per page (default 10)
            const skip = pageNum * pageSize; // Calculate skip amount 

            // 1. Filter by Contest Type (if provided)
            if (type) {
                query.contestType = type;
            }

            // 2. Search by Contest Name (if provided)
            if (search) {
                query.name = { $regex: search, $options: 'i' };
            }

            // Fetch contests with pagination and filtering
            const result = await contestsCollection.find(query)
                .skip(skip)
                .limit(pageSize)
                .toArray();

            // Get the total number of matching contests (for total page calculation on client side)
            const count = await contestsCollection.countDocuments(query);

            // Sending both contest data and the total count
            res.send({ contests: result, count });
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
        app.get('/creators/best', async (req, res) => {
            try {
                // 1. Group contests by creator and sum the participationCount
                const topCreators = await contestsCollection.aggregate([
                    // Filter: Only consider Accepted/Approved contests (assuming 'Accepted' is your approved status)
                    { $match: { status: 'Accepted' } },

                    {
                        $group: {
                            _id: "$creator", // Group by creator email
                            totalParticipation: { $sum: "$participationCount" }, // Sum up all participation counts for this creator
                            contestsCount: { $sum: 1 } // Count how many contests they have created
                        }
                    },
                    { $sort: { totalParticipation: -1 } }, // Sort by total participation descending
                    { $limit: 3 } // Take the top 3 creators
                ]).toArray();

                // 2. Extract creator emails
                const creatorEmails = topCreators.map(creator => creator._id);

                // 3. Find user profiles (name, image) from usersCollection
                const creatorProfiles = await usersCollection.find({
                    email: { $in: creatorEmails }
                }).toArray();

                // 4. Merge participation data with user profiles
                const bestCreators = topCreators.map(creator => {
                    const profile = creatorProfiles.find(p => p.email === creator._id);
                    return {
                        creatorEmail: creator._id,
                        totalParticipation: creator.totalParticipation,
                        contestsCount: creator.contestsCount,
                        name: profile?.name || 'Unknown Creator', // Use profile name or fallback
                        image: profile?.image || 'https://via.placeholder.com/150' // Use profile image or fallback
                    };
                });

                res.send(bestCreators);

            } catch (error) {
                console.error('Error fetching best creators:', error);
                res.status(500).send({ message: 'Failed to fetch best creators' });
            }
        });
        // 1. Create Payment Intent (Client Secret)
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const { price } = req.body;
            // Stripe works with cents/paisha, so convert price to integer cents
            const amount = parseInt(price * 100);

            // Safety check for amount
            if (amount < 1) {
                return res.status(400).send({ error: 'Payment amount must be greater than zero.' });
            }

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: "usd", // Using USD as standard currency
                    payment_method_types: ['card'] // Only accepting card payments
                });

                // Send client secret back to the client
                res.send({
                    clientSecret: paymentIntent.client_secret,
                });

            } catch (error) {
                console.error("Stripe Error:", error.message);
                res.status(500).send({ error: 'Failed to create payment intent.' });
            }
        });
        // 2. Save Payment Information and Update Contest Participation
        app.post('/payments', verifyToken, async (req, res) => {
            const payment = req.body;

            // 1. Save payment details
            const paymentResult = await paymentsCollection.insertOne(payment);

            // 2. Update Contest participation count
            const contestId = payment.contestId;
            const updateContestResult = await contestsCollection.updateOne(
                { _id: new ObjectId(contestId) },
                {
                    $inc: { participationCount: 1 }, // Increment the participation count by 1
                    // Optional: You might want to store participant details in the contest document itself later
                }
            );

            // Optional: Add the user to a list of participants in the contest document
            // const addParticipantToContest = await contestsCollection.updateOne(
            //     { _id: new ObjectId(contestId) },
            //     { $push: { participants: payment.email } } 
            // );


            res.send({ paymentResult, updateContestResult });
        });
        // --- User Dashboard APIs (Protected by User Role) ---

        // 1. Get User's Participated Contests (My Participated Contests)
        app.get('/participated-contests', verifyToken, async (req, res) => {
            const userEmail = req.decoded.email;
            const query = { email: userEmail }; // Query payments made by the user

            // Get all successful payment records for the user
            const paymentRecords = await paymentsCollection.find(query).toArray();

            if (paymentRecords.length === 0) {
                return res.send([]);
            }

            // Extract all unique contest IDs
            const contestIds = paymentRecords.map(record => new ObjectId(record.contestId));

            // Find the actual contests using the IDs
            const contestsQuery = { _id: { $in: contestIds } };
            const contests = await contestsCollection.find(contestsQuery).toArray();

            // Merge payment info (e.g., transactionId, date) with contest details
            const participatedContests = contests.map(contest => {
                const paymentInfo = paymentRecords.find(p => p.contestId === contest._id.toString());
                return {
                    ...contest,
                    transactionId: paymentInfo.transactionId,
                    paidAmount: paymentInfo.price,
                    paymentDate: paymentInfo.date,
                    // Include status of the contest (for sorting by deadline/upcoming)
                };
            });

            // Sort by upcoming deadline (assuming contest.deadline is a valid date string)
            participatedContests.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

            res.send(participatedContests);
        });

        // --- User Profile Update API ---
        app.patch('/users/profile/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const updateFields = req.body;

            // Security check: Ensure token email matches the requested email
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }

            // Filter by email
            const filter = { email: email };

            // Update Document: Only set fields that are passed in the request body
            const updateDoc = {
                $set: updateFields,
            };

            const result = await usersCollection.updateOne(filter, updateDoc);

            if (result.matchedCount === 0) {
                return res.status(404).send({ message: 'User not found' });
            }
            res.send(result);
        });
        // --- Submission APIs (Commit 8: Protected by User Role) ---

        // 1. Submit a Contest Entry
        app.post('/submissions', verifyToken, async (req, res) => {
            const submission = req.body;
            const userEmail = req.decoded.email;
            const contestId = submission.contestId;

            // Basic Validation: Check if the user has paid for the contest
            const hasPaid = await paymentsCollection.findOne({
                email: userEmail,
                contestId: contestId
            });

            if (!hasPaid) {
                return res.status(403).send({ message: 'Forbidden: You must pay to participate in this contest.' });
            }

            // Check if the user has already submitted for this contest
            const alreadySubmitted = await submissionsCollection.findOne({
                contestId: contestId,
                participantEmail: userEmail
            });

            if (alreadySubmitted) {
                return res.status(400).send({ message: 'Bad Request: You have already submitted an entry for this contest.' });
            }

            // Prepare submission document
            const submissionToInsert = {
                ...submission,
                participantEmail: userEmail,
                submissionDate: new Date(),
                // Add default status like 'Pending Review' or just rely on existence
            };

            const result = await submissionsCollection.insertOne(submissionToInsert);
            res.send(result);
        });

        // --- Creator/Submission Management APIs (Commit 8) ---

        // 2. Get all Submissions for a specific contest (Protected by Creator Role)
        app.get('/submissions/contest/:contestId', verifyToken, verifyCreator, async (req, res) => {
            const contestId = req.params.contestId;
            const creatorEmail = req.decoded.email;

            if (!ObjectId.isValid(contestId)) {
                return res.status(400).send({ message: 'Invalid Contest ID' });
            }

            // 1. Check if the current Creator owns this contest
            const contest = await contestsCollection.findOne({
                _id: new ObjectId(contestId),
                creator: creatorEmail
            });

            if (!contest) {
                return res.status(403).send({ message: 'Forbidden: You are not the creator of this contest.' });
            }

            // 2. Fetch all submissions for that contest
            const query = { contestId: contestId };
            const submissions = await submissionsCollection.find(query).toArray();

            res.send(submissions);
        });

        // 3. Declare Winner for a Contest (Protected by Creator Role)
        app.patch('/contests/winner/:contestId', verifyToken, verifyCreator, async (req, res) => {
            const contestId = req.params.contestId;
            const { winnerEmail, winnerName, winnerImage } = req.body;
            const creatorEmail = req.decoded.email;

            if (!ObjectId.isValid(contestId)) {
                return res.status(400).send({ message: 'Invalid Contest ID' });
            }

            // 1. Check if the current Creator owns this contest
            const contest = await contestsCollection.findOne({
                _id: new ObjectId(contestId),
                creator: creatorEmail
            });

            if (!contest) {
                return res.status(403).send({ message: 'Forbidden: You are not the creator of this contest.' });
            }

            // 2. Check if the winner email actually participated in the contest (optional but good practice)
            const isParticipant = await submissionsCollection.findOne({
                contestId: contestId,
                participantEmail: winnerEmail
            });

            if (!isParticipant) {
                console.warn(`Warning: Declaring winner (${winnerEmail}) who did not submit to contest ${contestId}`);
            }

            // 3. Update the contest document to include winner details
            const filter = { _id: new ObjectId(contestId) };
            const updateDoc = {
                $set: {
                    winner: {
                        email: winnerEmail,
                        name: winnerName,
                        image: winnerImage,
                        declarationDate: new Date(),
                    },
                    status: 'Completed' // Mark contest as completed
                },
            };

            const result = await contestsCollection.updateOne(filter, updateDoc);

            if (result.matchedCount === 0) {
                return res.status(404).send({ message: 'Contest not found' });
            }

            res.send(result);
        });

        // --- Public APIs (Contests with Winners) (Commit 8) ---

        // 4. Get all contests where a winner has been declared (Publicly accessible)
        app.get('/contests/winners', async (req, res) => {
            // Query contests that have a 'winner' field set, and status is 'Completed'
            const query = { winner: { $exists: true }, status: 'Completed' };

            // Sort by latest declaration date
            const result = await contestsCollection.find(query)
                .sort({ 'winner.declarationDate': -1 })
                .toArray();

            res.send(result);
        });
        app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
            // 1. Total Users Count
            const totalUsers = await usersCollection.estimatedDocumentCount();

            // 2. Total Contests Count (All statuses)
            const totalContests = await contestsCollection.estimatedDocumentCount();

            // 3. Total Payments/Revenue (Calculate total price from payments collection)
            const totalRevenueResult = await paymentsCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$price' } // Assuming 'price' is the payment amount
                    }
                }
            ]).toArray();

            const totalRevenue = totalRevenueResult.length > 0 ? totalRevenueResult[0].totalRevenue : 0;


            // 4. Total Contests Participated (Sum of participationCount from contests)
            const totalParticipationsResult = await contestsCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalParticipations: { $sum: '$participationCount' }
                    }
                }
            ]).toArray();

            const totalParticipations = totalParticipationsResult.length > 0 ? totalParticipationsResult[0].totalParticipations : 0;

            res.send({
                totalUsers,
                totalContests,
                totalRevenue,
                totalParticipations,
            });
        });

        // --- Admin Get All Users API ---
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const { page, size } = req.query;

            // Handle Pagination
            const pageNum = parseInt(page) || 0;
            const pageSize = parseInt(size) || 10;
            const skip = pageNum * pageSize;

            // Fetch users with pagination
            const result = await usersCollection.find()
                .skip(skip)
                .limit(pageSize)
                .toArray();

            // Get total count
            const count = await usersCollection.estimatedDocumentCount();

            // Sending both user data and the total count
            res.send({ users: result, count });
        });

        // --- Admin Update User Role API (Make Creator/Admin) ---
        app.patch('/users/role/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const { role } = req.body; // role can be 'Creator' or 'Admin'

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: 'Invalid User ID' });
            }

            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: role
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);

            if (result.matchedCount === 0) {
                return res.status(404).send({ message: 'User not found' });
            }
            res.send(result);
        });

        // <--- COMMIT 8 APIs END HERE --->

        // 1. Get All Contests (including Pending/Rejected) for Admin Dashboard
        app.get('/contests/admin', verifyToken, verifyAdmin, async (req, res) => {
            // Admin needs to see all contests regardless of status
            const result = await contestsCollection.find().toArray();
            res.send(result);
        });
        // 2. Update Contest Status (Approve/Reject)
        app.patch('/contests/status/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const { status } = req.body; // status will be 'Accepted' or 'Rejected'

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: 'Invalid Contest ID' });
            }

            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: status
                },
            };

            const result = await contestsCollection.updateOne(filter, updateDoc);

            if (result.matchedCount === 0) {
                return res.status(404).send({ message: 'Contest not found' });
            }
            res.send(result);
        });
        // 3. Delete a Contest by ID
        app.delete('/contests/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ message: 'Invalid Contest ID' });
            }

            const query = { _id: new ObjectId(id) };
            const result = await contestsCollection.deleteOne(query);

            if (result.deletedCount === 0) {
                return res.status(404).send({ message: 'Contest not found' });
            }
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