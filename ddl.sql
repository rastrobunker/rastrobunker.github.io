-- DDL para Rastro Búnker - Catálogo de Piezas
-- Generado automáticamente a partir de index.html

CREATE DATABASE IF NOT EXISTS rastro_bunker
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE rastro_bunker;

DROP TABLE IF EXISTS productos;

CREATE TABLE productos (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  id_legacy     INT UNSIGNED NULL COMMENT 'ID numerico original del catalogo',
  codigo        VARCHAR(20)  NULL,
  categoria     VARCHAR(100) NULL,
  marca         VARCHAR(100) NULL,
  modelo        VARCHAR(100) NULL,
  anio          VARCHAR(20)  NULL,
  lado          VARCHAR(10)  NULL,
  condicion     VARCHAR(20)  NULL,
  precio        DECIMAL(10,2) NULL,
  vendido       TINYINT(1)   NOT NULL DEFAULT 0,
  cantidad      INT          NULL,
  detalle       TEXT         NULL,
  posicion      VARCHAR(50)  NULL,
  bgc           VARCHAR(20)  NULL COMMENT 'Color de fondo de la tarjeta',
  fit           VARCHAR(20)  NULL COMMENT 'Estilo de ajuste de la foto (ej. contain/full)',
  alias         VARCHAR(150) NULL,
  foto          LONGTEXT     NULL COMMENT 'Imagen en base64 (data URI)',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_categoria (categoria),
  KEY idx_marca (marca),
  KEY idx_vendido (vendido)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
