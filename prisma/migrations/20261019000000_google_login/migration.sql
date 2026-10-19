-- "Continuar con Google": cuenta de Google vinculada y si la cuenta tiene contraseña propia.
ALTER TABLE "usuarios" ADD COLUMN "google_sub" VARCHAR(255),
                       ADD COLUMN "tiene_contrasena" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "usuarios_google_sub_key" ON "usuarios"("google_sub");
