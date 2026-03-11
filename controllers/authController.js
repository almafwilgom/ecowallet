import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {
  const { full_name, email, password, state } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const user = await pool.query(
    "INSERT INTO users(full_name,email,password_hash,state,role) VALUES($1,$2,$3,$4,'user') RETURNING *",
    [full_name,email,hashed,state]
  );

  await pool.query(
    "INSERT INTO wallets(user_id,balance) VALUES($1,0)",
    [user.rows[0].id]
  );

  res.json({ message: "Registered" });
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await pool.query("SELECT * FROM users WHERE email=$1",[email]);
  if (!user.rows.length) return res.status(400).json({ message:"User not found" });

  const valid = await bcrypt.compare(password,user.rows[0].password_hash);
  if (!valid) return res.status(400).json({ message:"Invalid credentials" });

  const token = jwt.sign(
    { id:user.rows[0].id, role:user.rows[0].role },
    process.env.JWT_SECRET,
    { expiresIn:"7d" }
  );

  res.json({ token });
};