import pool from "../config/db.js";
import { mockPaystack } from "../utils/mockPaystack.js";
import { mockVTpass } from "../utils/mockVTpass.js";

export const getWallet = async (req,res) => {
  const wallet = await pool.query(
    "SELECT balance FROM wallets WHERE user_id=$1",
    [req.user.id]
  );
  res.json(wallet.rows[0]);
};

export const withdraw = async (req,res) => {
  const { amount } = req.body;
  const userId = req.user.id;

  await pool.query(
    "UPDATE wallets SET balance=balance-$1 WHERE user_id=$2 AND balance>=$1",
    [amount,userId]
  );

  await mockPaystack(amount);

  res.json({ message:"Withdrawal successful (mock)" });
};

export const buyAirtime = async (req,res) => {
  const { amount } = req.body;
  const userId = req.user.id;

  await pool.query(
    "UPDATE wallets SET balance=balance-$1 WHERE user_id=$2 AND balance>=$1",
    [amount,userId]
  );

  await mockVTpass(amount);

  res.json({ message:"Airtime purchased (mock)" });
};