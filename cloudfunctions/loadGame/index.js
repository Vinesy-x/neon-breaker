// 云函数：loadGame - 加载玩家存档
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { code: -1, msg: 'no openid' };

  try {
    const res = await db.collection('game_saves').where({ _openid: openid }).get();
    if (res.data.length > 0) {
      return { code: 0, saveData: res.data[0].saveData, updatedAt: res.data[0].updatedAt };
    } else {
      return { code: 0, saveData: null, msg: 'no save found' };
    }
  } catch (e) {
    return { code: -1, msg: e.message };
  }
};
