// Server ve clientlar arasında haberleşmeyi sağlayan operasyon kodları.
enum OpCode {
  // Oyun başladı.
  START = 1,
  // Puanlar güncellendi.
  UPDATE = 2,
  // Oyun tamamlandı.
  DONE = 3,
}

interface Points {
  [userId: string]: number;
}

type Message =
  | StartMessage
  | UpdateMessage
  | DoneMessage
  | RpcFindMatchResponse;
// Oyun başladığında clientlara gönderilen mesaj.
interface StartMessage {
  message: string;
  // Kalan süre.
  deadline: number;
}

// Oyun durumu veya oyuncu durumları güncellendiğinde gönderilen mesaj.
interface UpdateMessage {
  message: string;
  points: Points;
  // Kalan süre.
  deadline: number;
}

// Oyun tamamlandığında clientlara gönderilen mesaj.
interface DoneMessage {
  points: Points;
  message: string;
}

// Oyuncunun katılabileceği matchIdler.
interface RpcFindMatchResponse {
  matchIds: string[];
}
