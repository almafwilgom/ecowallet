import pool from "../config/db.js";
import { calculatePayout } from "../utils/calculatePayout.js";

export const submitWaste = async (req,res) => {
  const { material, weight } = req.body;
  const userId = req.user.id;

  const user = await pool.query("SELECT state FROM users WHERE id=$1",[userId]);
  const payout = calculatePayout(material,weight,user.rows[0].state);

  await pool.query(
    "INSERT INTO wastecollections(user_id,material_type,weight,payout_amount,state) VALUES($1,$2,$3,$4,$5)",
    [userId,material,weight,payout,user.rows[0].state]
  );

  await pool.query(
    "UPDATE wallets SET balance=balance+$1 WHERE user_id=$2",
    [payout,userId]
  );

  res.json({ payout });
};