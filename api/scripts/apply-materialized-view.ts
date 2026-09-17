// Applies sql/materialized_view.sql programmatically against the DB configured in .env.
// MySQL has no native MATERIALIZED VIEW, so productos_mv is a real table kept in sync by triggers.
// DELIMITER is a mysql-CLI-only directive; here each statement is sent as a single raw query instead.
// Uses mysql2 (not Prisma) because CREATE PROCEDURE/TRIGGER are rejected by MySQL's prepared-statement protocol.
import mysql from 'mysql2/promise'

const connection = await mysql.createConnection(process.env.DATABASE_URL!)

const statements = [
  `SET GLOBAL log_bin_trust_function_creators = 1`,
  `DROP TABLE IF EXISTS productos_mv`,
  `CREATE TABLE productos_mv (
    id          CHAR(36)      NOT NULL,
    id_legacy   INT UNSIGNED  NULL,
    codigo      VARCHAR(20)   NULL,
    categoria   VARCHAR(100)  NULL,
    marca       VARCHAR(100)  NULL,
    modelo      VARCHAR(100)  NULL,
    anio        VARCHAR(20)   NULL,
    lado        VARCHAR(10)   NULL,
    condicion   VARCHAR(20)   NULL,
    precio      DECIMAL(10,2) NULL,
    vendido     TINYINT(1)    NOT NULL DEFAULT 0,
    cantidad    INT           NULL,
    posicion    VARCHAR(50)   NULL,
    alias       VARCHAR(150)  NULL,
    tiene_foto  TINYINT(1)    NOT NULL DEFAULT 0 COMMENT 'Evita traer el base64 en el listado',
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_mv_categoria (categoria),
    KEY idx_mv_marca (marca),
    KEY idx_mv_modelo (modelo),
    KEY idx_mv_anio (anio),
    KEY idx_mv_lado (lado),
    KEY idx_mv_codigo (codigo),
    KEY idx_mv_vendido (vendido)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT='Vista materializada (sin foto) de productos para listado/paginacion rapidos'`,

  `INSERT INTO productos_mv
    (id, id_legacy, codigo, categoria, marca, modelo, anio, lado, condicion, precio, vendido, cantidad, posicion, alias, tiene_foto)
  SELECT
    id, id_legacy, codigo, categoria, marca, modelo, anio, lado, condicion, precio, vendido, cantidad, posicion, alias, (foto IS NOT NULL)
  FROM productos`,

  `DROP PROCEDURE IF EXISTS sp_refresh_productos_mv`,
  `CREATE PROCEDURE sp_refresh_productos_mv()
  BEGIN
    TRUNCATE TABLE productos_mv;
    INSERT INTO productos_mv
      (id, id_legacy, codigo, categoria, marca, modelo, anio, lado, condicion, precio, vendido, cantidad, posicion, alias, tiene_foto)
    SELECT
      id, id_legacy, codigo, categoria, marca, modelo, anio, lado, condicion, precio, vendido, cantidad, posicion, alias, (foto IS NOT NULL)
    FROM productos;
  END`,

  `DROP TRIGGER IF EXISTS trg_productos_ai`,
  `CREATE TRIGGER trg_productos_ai AFTER INSERT ON productos FOR EACH ROW
  BEGIN
    INSERT INTO productos_mv
      (id, id_legacy, codigo, categoria, marca, modelo, anio, lado, condicion, precio, vendido, cantidad, posicion, alias, tiene_foto)
    VALUES
      (NEW.id, NEW.id_legacy, NEW.codigo, NEW.categoria, NEW.marca, NEW.modelo, NEW.anio, NEW.lado, NEW.condicion, NEW.precio, NEW.vendido, NEW.cantidad, NEW.posicion, NEW.alias, (NEW.foto IS NOT NULL))
    ON DUPLICATE KEY UPDATE
      id_legacy = NEW.id_legacy, codigo = NEW.codigo, categoria = NEW.categoria, marca = NEW.marca, modelo = NEW.modelo,
      anio = NEW.anio, lado = NEW.lado, condicion = NEW.condicion, precio = NEW.precio, vendido = NEW.vendido,
      cantidad = NEW.cantidad, posicion = NEW.posicion, alias = NEW.alias, tiene_foto = (NEW.foto IS NOT NULL);
  END`,

  `DROP TRIGGER IF EXISTS trg_productos_au`,
  `CREATE TRIGGER trg_productos_au AFTER UPDATE ON productos FOR EACH ROW
  BEGIN
    INSERT INTO productos_mv
      (id, id_legacy, codigo, categoria, marca, modelo, anio, lado, condicion, precio, vendido, cantidad, posicion, alias, tiene_foto)
    VALUES
      (NEW.id, NEW.id_legacy, NEW.codigo, NEW.categoria, NEW.marca, NEW.modelo, NEW.anio, NEW.lado, NEW.condicion, NEW.precio, NEW.vendido, NEW.cantidad, NEW.posicion, NEW.alias, (NEW.foto IS NOT NULL))
    ON DUPLICATE KEY UPDATE
      id_legacy = NEW.id_legacy, codigo = NEW.codigo, categoria = NEW.categoria, marca = NEW.marca, modelo = NEW.modelo,
      anio = NEW.anio, lado = NEW.lado, condicion = NEW.condicion, precio = NEW.precio, vendido = NEW.vendido,
      cantidad = NEW.cantidad, posicion = NEW.posicion, alias = NEW.alias, tiene_foto = (NEW.foto IS NOT NULL);
  END`,

  `DROP TRIGGER IF EXISTS trg_productos_ad`,
  `CREATE TRIGGER trg_productos_ad AFTER DELETE ON productos FOR EACH ROW
  BEGIN
    DELETE FROM productos_mv WHERE id = OLD.id;
  END`,

  `SET GLOBAL event_scheduler = ON`,
  `DROP EVENT IF EXISTS ev_refresh_productos_mv`,
  `CREATE EVENT ev_refresh_productos_mv
    ON SCHEDULE EVERY 15 MINUTE
    DO CALL sp_refresh_productos_mv()`,
]

async function main() {
  for (const [i, sql] of statements.entries()) {
    process.stdout.write(`[${i + 1}/${statements.length}] ${sql.trim().slice(0, 60).replace(/\s+/g, ' ')}...\n`)
    await connection.query(sql)
  }
  console.log('productos_mv, triggers, sp_refresh_productos_mv y el evento de refresco quedaron creados.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await connection.end()
  })
