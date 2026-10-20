-- Pedidos hechos fuera de horario: hora real en que el cliente hizo el pedido
-- ("fecha" queda con la hora de la próxima apertura).
ALTER TABLE "ventas" ADD COLUMN "fecha_real" TIMESTAMP(3);
