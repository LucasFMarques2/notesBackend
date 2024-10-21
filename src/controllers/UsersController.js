const { hash, compare } = require("bcryptjs");
const AppError = require("../utils/AppError");
const sqliteConnection = require("../database/sqlite");
const knex = require("../database/knex");

class UsersController {
  async create(req, res) {
    const { name, email, password } = req.body;

    const database = await sqliteConnection();
    const checkUserExists = await database.get(`SELECT * FROM users WHERE email = (?)`, [email]);

    if (checkUserExists) {
      throw new AppError("Este e-mail já está em uso.");
    }

    const hashedPassword = await hash(password, 8);

    await database.run("INSERT INTO users (name, email, password) VALUES (?,?,?)", [name, email, hashedPassword]);

    return res.status(201).json();
  }

  async update(req, res) {
    const { name, email, password, old_password } = req.body;
    const user_id = req.user.id;

    const database = await sqliteConnection();
    const user = await database.get("SELECT * FROM users WHERE id = ?", [user_id]);

    if (!user) {
      throw new AppError("Usuário não encontrado");
    }

    const userWithUpdatedEmail = await database.get("SELECT * FROM users WHERE email = ?", [email]);

    if (userWithUpdatedEmail && userWithUpdatedEmail.id !== user.id) {
      throw new AppError("Este email já está em uso.");
    }

    user.name = name ?? user.name;
    user.email = email ?? user.email;

    if (password && !old_password) {
      throw new AppError("Você precisa informar a senha antiga.");
    }

    if (password && old_password) {
      const checkOldPassword = await compare(old_password, user.password);

      if (!checkOldPassword) {
        throw new AppError("Senha antiga incorreta.");
      }

      user.password = await hash(password, 8);
    }

    await database.run(`
      UPDATE users SET
      name = ?,
      email = ?,
      password = ?,
      updated_at = DATETIME('now')
      WHERE id = ?
    `, [user.name, user.email, user.password, user_id]);

    return res.json();
  }

  async index(req, res) {
    const isAdmin = req.user.isAdmin === 1;

    if (!isAdmin) {
      throw new AppError("Apenas administradores podem ver usuários.", 403);
    }

    const database = await sqliteConnection();
    const users = await database.all("SELECT id, name, email FROM users");
    return res.json(users);
  }

  async delete(req, res) {
    const { id } = req.params; 
    const isAdmin = req.user.isAdmin === 1;

    if (!isAdmin) {
      throw new AppError("Apenas administradores podem deletar usuários", 403);
    }

    await knex.transaction(async trx => {
      await trx("notes").where({ user_id: id }).del();
      await trx("users").where({ id }).del();
    });

    return res.status(200).json({ message: "Usuário e suas notas foram deletados com sucesso." });
  }



  
}

module.exports = UsersController;
