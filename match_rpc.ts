let rpcFindMatch: nkruntime.RpcFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  if (!ctx.userId) {
    throw Error("Kullanıcı bilgisi alınamadı.");
  }

  if (!payload) {
    throw Error("Mesaj alınamadı. Lütfen JSON formatında mesaj giriniz.");
  }

  let request = {};
  try {
    request = JSON.parse(payload);
  } catch (error) {
    logger.error(
      "JSON formatında mesaj giriniz. Mesaj dönüştürülemedi: %q",
      error
    );
    throw error;
  }

  let matches: nkruntime.Match[];
  try {
    matches = nk.matchList(10, true, null, null, 1);
  } catch (error) {
    logger.error("Maçlar listelenemedi: %v", error);
    throw error;
  }

  let matchIds: string[] = [];
  if (matches.length > 0) {
    // Kullanıcının katılabileceği maçlar bulunmaktadır.
    matchIds = matches.map((m) => m.matchId);
  } else {
    // Herhangi bir maç bulunmamaktadır. Yeni bir maç oluşturulacak.
    try {
      matchIds.push(nk.matchCreate(moduleName));
    } catch (error) {
      logger.error("Maç oluşturulamadı: %v", error);
      throw error;
    }
  }

  let res: RpcFindMatchResponse = { matchIds };
  return JSON.stringify(res);
};
