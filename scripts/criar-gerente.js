/* Uso LOCAL: npm run criar-gerente (pede os dados no terminal).
   A conta gerente não pode ser criada pelo cadastro público do site. */
'use strict';
require('dotenv').config();
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const bcrypt = require('bcryptjs');
const pool = require('../api/db');
const rl = readline.createInterface({ input: stdin, output: stdout });

const digits = (s) => s.replace(/\D/g, '');
(async () => {
  try {
    console.log('Criação do primeiro gerente (somente no seu banco local).');
    const nome = (await rl.question('Nome completo: ')).trim();
    const doc = digits(await rl.question('CPF ou RG (7 a 11 dígitos): '));
    const tel = digits(await rl.question('Telefone com DDD (10 ou 11 dígitos): '));
    const email = (await rl.question('E-mail: ')).trim().toLowerCase();
    const tipo = (await rl.question('Tipo sanguíneo [O+]: ')).trim().toUpperCase() || 'O+';
    const senha = await rl.question('Senha de acesso (mínimo 8 caracteres, letras e números): ');
    if (nome.length < 3 || nome.length > 100 || !/^\d{7,11}$/.test(doc) || !/^[1-9]{2}\d{8,9}$/.test(tel) ||
        !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(tipo) ||
        !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) || senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
      throw new Error('Dados inválidos. Revise os campos e tente novamente.');
    }
    const hash = await bcrypt.hash(senha, 12);
    await pool.query(`INSERT INTO usuarios (perfil,nome,documento,telefone,email,tipo_sanguineo,ultima_info,senha_hash)
      VALUES ('gerente',$1,$2,$3,$4,$5,'nunca',$6)`, [nome, doc, tel, email, tipo, hash]);
    console.log('Gerente criado! Agora entre no site com o documento e a senha definidos.');
  } catch (error) {
    console.error(error.code === '23505' ? 'Documento ou e-mail já está cadastrado.' : error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
})();
