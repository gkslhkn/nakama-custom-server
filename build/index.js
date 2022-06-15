"use strict";
var rpcIdFindMatch = "find_match_js";
function InitModule(ctx, logger, nk, initializer) {
    initializer.registerRpc(rpcIdFindMatch, rpcFindMatch);
    initializer.registerMatch(moduleName, {
        matchInit: matchInit,
        matchJoinAttempt: matchJoinAttempt,
        matchJoin: matchJoin,
        matchLeave: matchLeave,
        matchLoop: matchLoop,
        matchTerminate: matchTerminate,
        matchSignal: matchSignal,
    });
    logger.info("Custom server başladı.");
}
// Server ve clientlar arasında haberleşmeyi sağlayan operasyon kodları.
var OpCode;
(function (OpCode) {
    // Oyun başladı.
    OpCode[OpCode["START"] = 1] = "START";
    // Puanlar güncellendi.
    OpCode[OpCode["UPDATE"] = 2] = "UPDATE";
    // Oyun tamamlandı.
    OpCode[OpCode["DONE"] = 3] = "DONE";
})(OpCode || (OpCode = {}));
var moduleName = "stay_alive_for_a_minute";
var tickRate = 1;
var pointsPerTick = 10;
var gameDurationLimit = 60;
var maxEmptySec = 30;
var matchInit = function (ctx, logger, nk, params) {
    var state = {
        emptyTicks: 0,
        presences: {},
        points: {},
        joinsInProgress: 0,
        playing: false,
        gameDuration: gameDurationLimit,
    };
    return {
        state: state,
        tickRate: tickRate,
        label: "stay_alive_for_a_minute",
    };
};
var matchJoinAttempt = function (ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
    // Bağlantı sorunu nedeniyle tekar bağlantıları kontrol ediyoruz.
    if (presence.userId in state.presences) {
        if (state.presences[presence.userId] === null) {
            // Kullanıcı bağlantı sorunu nedeniyle tekrar bağlanıyor.
            state.joinsInProgress++;
            return {
                state: state,
                accept: false,
            };
        }
        else {
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
        state: state,
        accept: true,
    };
};
var matchJoin = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    for (var _i = 0, presences_1 = presences; _i < presences_1.length; _i++) {
        var presence = presences_1[_i];
        state.emptyTicks = 0;
        state.presences[presence.userId] = presence;
        state.joinsInProgress--;
        if (state.points[presence.userId] === null) {
            state.points[presence.userId] = 0;
        }
        // Mevcut oyun durumu hakkında güncelleme gönderiyoruz.
        if (state.playing) {
            // Devam eden oyun var. Güncelleme gönderiyoruz.
            var update = {
                points: state.points,
                deadline: state.gameDuration,
                message: "Oyun devam ediyor.",
            };
            // Az önce katılan oyuncuya gümcelleme gönderiyoruz.
            dispatcher.broadcastMessage(OpCode.UPDATE, JSON.stringify(update));
            logger.debug("Mesaj gönderildi:", JSON.stringify(update));
        }
        else {
            logger.debug("Oyuncu %s oyuna katıldı.", presence.userId);
            // Oyun sonlandıktan sonra katılan oyuncuya, oyunun bittiğine dair güncelleme gönderiyoruz.
            var done = {
                points: state.points,
                message: "Oyun bitti.",
            };
            // Az önce katılan oyuncuya, oyunun bittiğine dair güncelleme gönderiyoruz.
            dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(done));
            logger.debug("Mesaj gönderildi:", JSON.stringify(done));
        }
    }
    return { state: state };
};
var matchLeave = function (ctx, logger, nk, dispatcher, tick, state, presences) {
    for (var _i = 0, presences_2 = presences; _i < presences_2.length; _i++) {
        var presence = presences_2[_i];
        logger.info("Oyuncu: %s maçtan çıktı: %s.", presence.userId, ctx.matchId);
        state.presences[presence.userId] = null;
    }
    return { state: state };
};
var matchLoop = function (ctx, logger, nk, dispatcher, tick, state, messages) {
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
        for (var userID in state.presences) {
            if (state.presences[userID] === null) {
                delete state.presences[userID];
            }
        }
        if (connectedPlayers(state) === 0)
            return { state: state };
        // Oyun başlıyor.
        state.playing = true;
        // Oyunun başlangıç zamanı.
        state.gameDuration = gameDurationLimit;
        // Oyun başladığında oyunculara başlama mesajı gönderiyoruz.
        var msg = {
            message: "Oyun başladı.",
            deadline: state.gameDuration,
        };
        dispatcher.broadcastMessage(OpCode.START, JSON.stringify(msg));
        logger.debug(msg.message);
        return { state: state };
    }
    if (state.playing) {
        for (var userID in state.presences) {
            if (state.presences[userID] !== null) {
                if (isNaN(state.points[userID])) {
                    state.points[userID] = 0;
                }
                else {
                    state.points[userID] += pointsPerTick;
                }
                logger.debug("Oyuncu %s %d puan kazandı.", userID, state.points[userID]);
            }
        }
        state.gameDuration--;
        if (state.gameDuration <= 0) {
            // Oyun süresi doldu. Puanlamaları gönderiyoruz.
            state.playing = false;
            var msg = {
                points: state.points,
                message: "Oyun bitti.",
            };
            dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify(msg));
            logger.debug("Oyun süresi doldu, Maç sonlandırılıyor.", JSON.stringify(msg));
            return null;
        }
    }
    logger.info("Oyun süresi. Kalan: %d", state.gameDuration);
    return { state: state };
};
var matchTerminate = function (ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
    return { state: state };
};
var matchSignal = function (ctx, logger, nk, dispatcher, tick, state) {
    return { state: state };
};
function connectedPlayers(s) {
    var count = 0;
    for (var _i = 0, _a = Object.keys(s.presences); _i < _a.length; _i++) {
        var p = _a[_i];
        if (p !== null) {
            count++;
        }
    }
    return count;
}
var rpcFindMatch = function (ctx, logger, nk, payload) {
    if (!ctx.userId) {
        throw Error("Kullanıcı bilgisi alınamadı.");
    }
    if (!payload) {
        throw Error("Mesaj alınamadı. Lütfen JSON formatında mesaj giriniz.");
    }
    var request = {};
    try {
        request = JSON.parse(payload);
    }
    catch (error) {
        logger.error("JSON formatında mesaj giriniz. Mesaj dönüştürülemedi: %q", error);
        throw error;
    }
    var matches;
    try {
        matches = nk.matchList(10, true, null, null, 1);
    }
    catch (error) {
        logger.error("Maçlar listelenemedi: %v", error);
        throw error;
    }
    var matchIds = [];
    if (matches.length > 0) {
        // Kullanıcının katılabileceği maçlar bulunmaktadır.
        matchIds = matches.map(function (m) { return m.matchId; });
    }
    else {
        // Herhangi bir maç bulunmamaktadır. Yeni bir maç oluşturulacak.
        try {
            matchIds.push(nk.matchCreate(moduleName));
        }
        catch (error) {
            logger.error("Maç oluşturulamadı: %v", error);
            throw error;
        }
    }
    var res = { matchIds: matchIds };
    return JSON.stringify(res);
};
