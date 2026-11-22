'use strict';
require('dotenv').config();
const { Pool } = require('pg');
if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL no arquivo .env');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
module.exports = pool;
