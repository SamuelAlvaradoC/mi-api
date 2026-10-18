-- Carrito del cliente guardado en el servidor (web y app).
-- Solo agrega una tabla nueva; no modifica ninguna existente.

-- CreateTable
CREATE TABLE "carritos" (
    "id_usuario" INTEGER NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "actualizado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carritos_pkey" PRIMARY KEY ("id_usuario")
);

-- AddForeignKey
ALTER TABLE "carritos" ADD CONSTRAINT "carritos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
