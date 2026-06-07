import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { createUser, findUserByEmail, findUserById } from "../db/index.js";
import type { User } from "../types.js";

const SALT_ROUNDS = 10;

/** Hash a plaintext password */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

/** Compare a plaintext password against a hash */
export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

/**
 * Register a new user account.
 * Returns the created user (sans sensitive fields).
 */
export function registerUser(
  email: string,
  password: string,
  ovatuApiKey: string
): User {
  const existing = findUserByEmail(email);
  if (existing) {
    throw new Error("A user with this email already exists");
  }

  const apiKeyHash = hashPassword(password);
  return createUser(email, apiKeyHash, ovatuApiKey);
}

/**
 * Authenticate a user by email + password.
 * Returns the user on success, throws on failure.
 */
export function authenticateUser(
  email: string,
  password: string
): User {
  const user = findUserByEmail(email);
  if (!user) {
    throw new Error("Invalid email or password");
  }
  if (!verifyPassword(password, user.api_key_hash)) {
    throw new Error("Invalid email or password");
  }
  return user;
}

/**
 * Return a sanitised user object (no password hash, no ovatu key).
 */
export function sanitiseUser(user: User): Omit<User, "api_key_hash" | "ovatu_api_key"> {
  return {
    id: user.id,
    email: user.email,
    last_checked_at: user.last_checked_at,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}