const moduleName = "stay_alive_for_a_minute";
const tickRate = 1;
const pointsPerTick = 10;
const gameDurationLimit = 60;
const maxEmptySec = 30;

interface State {
  emptyTicks: number;
  // Bağlanmış olan oyuncular
  presences: { [userId: string]: nkruntime.Presence | null };
  // Bağlanmış oyuncuların puanları.
  points: Points;
  // Bağlanmaya çalışan oyuncuların sayısı.
  joinsInProgress: number;
  // Oynanan oyun var ise true.
  playing: boolean;
  // Oyununun toplam süresi.
  gameDuration: number;
}

let matchInit: nkruntime.MatchInitFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
) {
  var state: State = {
    emptyTicks: 0,
    presences: {},
    points: {},
    joinsInProgress: 0,
    playing: false,
    gameDuration: gameDurationLimit,
  };

  return {
    state,
    tickRate,
    label: "stay_alive_for_a_minute",
  };
};

let matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: State,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
) {
  // Bağlantı sorunu nedeniyle tekar bağlantıları kontrol ediyoruz.
  if (presence.userId in state.presences) {
    if (state.presences[presence.userId] === null) {
      // Kullanıcı bağlantı sorunu nedeniyle tekrar bağlanıyor.
      state.joinsInProgress++;
      return {
        state: state,
        accept: false,
      };
    } else {
      // Kullanıcı zaten bağlantılı. İki farklı cihazdan bağlanmaya çalışıyor.
      return {
        state: state,
        accept: false,
        rejectMessage: "Zaten bağlantılısın.",
      };
    }
  }

  // Yeni oyuncu bağlanmaya çalışıyor.
  state.joinsInProgress++;
  return {
    state,
    accept: true,
  };
};

let matchJoin: nkruntime.MatchJoinFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: State,
  presences: nkruntime.Presence[]
) {
  for (const presence of presences) {
    state.emptyTicks = 0;
    state.presences[presence.userId] = presence;
    state.joinsInProgress--;

    if (isNaN(state.points[presence.userId])) {
      state.points[presence.userId] = 0;
    }

    // Mevcut oyun durumu hakkında güncelleme gönderiyoruz.
    if (state.playing) {
      // Devam eden oyun var. Güncelleme gönderiyoruz.
      let update: UpdateMessage = {
        points: state.points,
        deadline: state.gameDuration,
        message: "Oyun devam ediyor.",
      };
      // Az önce katılan oyuncuya gümcelleme gönderiyoruz.
      dispatcher.broadcastMessage(OpCode.UPDATE, JSON.stringify(update));
    } else {
      logger.debug("Oyuncu %s oyuna katıldı.", presence.userId);
      // Oyun sonlandıktan sonra katılan oyuncuya, oyunun bittiğine dair güncelleme gönderiyoruz.
      let done: DoneMessage = {
        points: state.points,
        message: "Oyun bitti.",
      };
      // Az önce katılan oyuncuya, oyunun bittiğine dair güncelleme gönderiyoruz.
      dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(done));
    }
  }

  return { state };
};

let matchLeave: nkruntime.MatchLeaveFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: State,
  presences: nkruntime.Presence[]
) {
  for (let presence of presences) {
    logger.info("Oyuncu: %s maçtan çıktı: %s.", presence.userId, ctx.matchId);
    state.presences[presence.userId] = null;
  }

  return { state };
};

let matchLoop: nkruntime.MatchLoopFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: State,
  messages: nkruntime.MatchMessage[]
) {
  logger.debug("Oyun döngüsü başladı. Tick: %d", tick);

  if (connectedPlayers(state) + state.joinsInProgress === 0) {
    state.emptyTicks++;
    if (state.emptyTicks >= maxEmptySec * tickRate) {
      // Maç uzun süre boş kaldı. Kapatıyoruz.
      logger.info("Oyuncu katılımı olmadı. Maç sonlandırılıyor.");
      return null;
    }
  }

  if (!state.playing) {
    // Bağlantısı kopan oyuncuları çıkar.
    for (let userID in state.presences) {
      if (state.presences[userID] === null) {
        delete state.presences[userID];
      }
    }

    if (connectedPlayers(state) === 0) return { state };

    // Oyun başlıyor.
    state.playing = true;
    // Oyunun başlangıç zamanı.
    state.gameDuration = gameDurationLimit;
    // Oyun başladığında oyunculara başlama mesajı gönderiyoruz.
    let msg: StartMessage = {
      message: "Oyun başladı. " + state.gameDuration + " saniye süre var.",
      deadline: state.gameDuration,
    };
    dispatcher.broadcastMessage(OpCode.START, JSON.stringify(msg));
    return { state };
  }

  if (state.playing) {
    for (let userID in state.presences) {
      if (state.presences[userID] !== null) {
        if (isNaN(state.points[userID])) {
          state.points[userID] = 0;
        } else {
          state.points[userID] += pointsPerTick;
        }
        logger.debug(
          "Oyuncu %s %d puan kazandı.",
          userID,
          state.points[userID]
        );
      }
    }
    state.gameDuration--;
    if (state.gameDuration <= 0) {
      // Oyun süresi doldu. Puanlamaları gönderiyoruz.
      state.playing = false;

      let msg: DoneMessage = {
        points: state.points,
        message: "Oyun bitti.",
      };
      dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(msg));
      logger.debug(
        "Oyun süresi doldu, Maç sonlandırılıyor.",
        JSON.stringify(msg)
      );
      return null;
    }
  }
  logger.info("Oyun süresi. Kalan: %d", state.gameDuration);

  return { state };
};

let matchTerminate: nkruntime.MatchTerminateFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: State,
  graceSeconds: number
) {
  return { state };
};

let matchSignal: nkruntime.MatchSignalFunction<State> = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: State
) {
  return { state };
};

function connectedPlayers(s: State): number {
  let count = 0;
  for (const p of Object.keys(s.presences)) {
    if (p !== null) {
      count++;
    }
  }
  return count;
}
