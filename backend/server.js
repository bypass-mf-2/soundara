import express from "express";
import Stripe from "stripe";
import cors from "cors";

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

const freeUsers = ["123456789"];

const userLibraries = {};

// Create checkout session
app.post("/create-checkout-session", async (req, res) => {

  const { track, user_id } = req.body;

  if (freeUsers.includes(user_id)) {
    return res.json({
      url: `http://localhost:5173/success?user=${user_id}&track=${track.file}`
    });
  }

  const session = await stripe.checkout.sessions.create({

    payment_method_types: ["card"],

    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: track.name },
        unit_amount: track.price_cents,
      },
      quantity: 1,
    }],

    mode: "payment",

    success_url: `http://localhost:5173/success?user=${user_id}&track=${track.file}`,

    cancel_url: `http://localhost:5173/`,

  });

  res.json({ url: session.url });

});

// Add track to library
app.post("/user_library/:user/add", (req, res) => {

  const user = req.params.user;
  const track = req.body;

  if (!userLibraries[user]) {
    userLibraries[user] = [];
  }

  userLibraries[user].push(track);

  res.json({ status: "added" });

});

// Load library
app.get("/user_library/:user", (req, res) => {

  const user = req.params.user;

  res.json(userLibraries[user] || []);

});

app.listen(8000, () => console.log("Server running on port 8000"));