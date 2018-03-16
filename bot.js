const Eris = require('eris');
const Https = require('https');
const URL = 'https://mntone.github.io/splatoon2-data/main.json'; // ブキの情報json
let bot = new Eris("NDIzNzIxNjYwNjU5NzkzOTIw.DYuhUQ.EFuzsjNAZlxvEB78h30KSUGJkdA");
let currntRoomId = ""; // ブキルーレットを行う部屋
let channels = {}; // チャンネル、チャンネル内メンバーが入るオブジェクト
let weapons = []; // ブキ一覧配列

bot.connect();

// アプリケーション起動時
bot.on("ready", () => {
  console.log("Ready!");
  // ready時に入っていたメンバーを配列に追加
  for( let i = 0; i < Object.keys(bot.channelGuildMap).length; i++ ){
    let ch = bot.getChannel(Object.keys(bot.channelGuildMap)[i]);
    if( ch.voiceMembers ){
      ch.voiceMembers.find((member) => addMember( member, ch ));
    }
  }

  // 外部サイトからJson形式でブキ情報を取得。ブキ配列に格納
  Https.get( URL, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on( 'data', (chunk) => body += chunk );
    res.on('end', (res) => {
        res = JSON.parse(body);
        for( let i = 0; i < Object.keys(res).length; i++ ){
          let weaponName = res[Object.keys(res)[i]].localization.ja;
          if( weaponName.indexOf( 'レプリカ' ) != -1 ) continue; // レプリカ系は省く
          weapons.push( weaponName ); // ブキ配列に登録
        }
    });
  }).on('error', (e) => console.log(e.message) ); //エラー時
});

// ユーザーがコメントしたとき
bot.on("messageCreate", (msg) => {
  if( msg.content === "!bukiru" ) { // ブキルーレット開始
    console.log('bukiru');
    sendWeaponsRoulette( msg );
  } else if( msg.content.indexOf("!room") == 0 ) { // 部屋登録
    console.log('room');
    let startPoint = msg.content.indexOf(" ");
    let targetRoom = msg.content.slice( startPoint + 1 );

    // 部屋の名前から部屋IDを探して、currntRoomIdに保存
    for( let i = 0; i < Object.keys(bot.channelGuildMap).length; i++ ){
      let ch = bot.getChannel(Object.keys(bot.channelGuildMap)[i]);
      if( ch.name == targetRoom ){
        currntRoomId = ch.id;
        bot.createMessage( msg.channel.id, 'ブキルーレットの部屋を' + targetRoom + 'に設定しました！' );
      }
    }
  } else if( msg.content === "!member" ){ // 現在の入室状況
    fetchAllMembers( msg );
  } else if( msg.content === "!help" ){ // ヘルプ
    bot.createMessage( msg.channel.id, 'よくわかる使い方！' );
    bot.createMessage( msg.channel.id, 'ブキルーレットを行う部屋を登録して、ルーレット開始コマンドを打つだけ！' );
    bot.createMessage( msg.channel.id, "部屋登録は「!room 〇〇」で行えます。〇〇にはボイスチャンネル名が入ります。" );
    bot.createMessage( msg.channel.id, "その後「!bukiru」でブキ抽選が行われ、開催部屋内にいるメンバー全員にDMを送ります！" );
    bot.createMessage( msg.channel.id, "「!bukiru」を打つのは一人でOK！" );
    bot.createMessage( msg.channel.id, "現在の入室状況を見たい場合は「!member」！" );
  }
});

// ユーザーが入室したとき
bot.on("voiceChannelJoin", (member, newChannel) => {
  addMember(member, newChannel);
});
// ユーザーが退室したとき
bot.on("voiceChannelLeave", (member, oldChannel) => {
  removeMember(member, oldChannel);
});

// Functions

// メンバーを配列に追加する
function addMember( member, channel ){
  let cannelId = channel.id;
  bot.getDMChannel( member.id ).then((data) => {
    let userObj = {
      'dmId': data.id,
      'userId': data.recipient.id,
      'name': data.recipient.username
    };
    if( ! channels[cannelId] ){ // なければ
      let arr = [ userObj ];
      channels[cannelId] = arr;
    } else { // あれば
      channels[cannelId].push( userObj );
    }
  });
}
// メンバーを配列から削除する
function removeMember( member, channel ){
  let cannelId = channel.id;
  bot.getDMChannel( member.id ).then((data) => {

    if( channels[cannelId] ){ // あれば
      for( let i = 0; i < channels[cannelId].length; i++ ){
        if( channels[cannelId][i].dmId == data.id ) delete channels[cannelId].splice( i, 1 );
      }
    }
  });
}
// サーバー内のメンバー入室状況を伝える
function fetchAllMembers( msg ){
  bot.createMessage( msg.channel.id, "現在の入室状況は" );
  for( let i = 0; i < Object.keys(channels).length; i++ ){
    let ch = bot.getChannel(Object.keys(channels)[i]);
    let txt = ch.name + '[ ';
    for( let j = 0; j < channels[Object.keys(channels)[i]].length; j++ ){
      if( j > 0 ) txt += ', ';
      let member = channels[Object.keys(channels)[i]][j];
      txt += member.name;
    }
    txt += ' ]';
    bot.createMessage( msg.channel.id, txt );
  }
}
// メンバー全員にDMを送る
function sendWeaponsRoulette( msg ){
  if( ! currntRoomId ){
    bot.createMessage( msg.channel.id, "ブキルーレットを行う部屋を設定してください！" );
    bot.createMessage( msg.channel.id, "部屋登録は「!room 〇〇」で行えます。〇〇にはボイスチャンネル名が入ります。" );
    return;
  }
  if( ! channels[currntRoomId] ){
    bot.createMessage( msg.channel.id, "開催する部屋にメンバーがいません！！" );
    return;
  }

  for( let i = 0; i < channels[currntRoomId].length; i++ ){
    let w = weapons[ Math.floor(Math.random() * weapons.length) ];
    bot.createMessage(channels[currntRoomId][i].dmId, 'あなたのブキは【' + w + '】に決まりました！' );
  }
}
