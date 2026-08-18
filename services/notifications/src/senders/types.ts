export interface NotificationSender {
  send(telefono: string, mensaje: string): Promise<void>;
}
