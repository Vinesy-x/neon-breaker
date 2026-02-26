// 云函数：saveGame - 保存玩家存档
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { code: -1, msg: 'no openid' };

  const { saveData } = event;
  if (!saveData || typeof saveData !== 'object') return { code: -1, msg: 'invalid data' };

  try {
    // 查找已有存档
    const res = await db.collection('game_saves').where({ _openid: openid }).get();

    if (res.data.length > 0) {
      // 更新
      await db.collection('game_saves').where({ _openid: openid }).update({
        data: {
          saveData: saveData,
          updatedAt: db.serverDate(),
        }
      });
    } else {
      // 新建
      await db.collection('game_saves').add({
        data: {
          _openid: openid,
          saveData: saveData,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate(),
        }
      });
    }
    return { code: 0, msg: 'ok' };
  } catch (e) {
    return { code: -1, msg: e.message };
  }
};
