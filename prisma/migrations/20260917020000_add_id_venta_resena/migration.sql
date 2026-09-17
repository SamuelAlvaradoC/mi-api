ALTER TABLE resenas ADD COLUMN IF NOT EXISTS id_venta INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resenas_id_venta_key'
  ) THEN
    ALTER TABLE resenas ADD CONSTRAINT resenas_id_venta_key UNIQUE (id_venta);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resenas_id_venta_fkey'
  ) THEN
    ALTER TABLE resenas ADD CONSTRAINT resenas_id_venta_fkey
      FOREIGN KEY (id_venta) REFERENCES ventas(id_venta) ON DELETE SET NULL;
  END IF;
END $$;
