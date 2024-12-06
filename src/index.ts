import {
    Canister,
    Err,
    Ok,
    Principal,
    Record,
    Result,
    StableBTreeMap,
    Variant,
    Vec,
    ic,
    nat64,
    query,
    text,
    update,
  } from "azle/experimental";
  
  const replies = Record({
    by: Principal,
    newsid: Principal,
    reply: text,
  });
  
  //defines types
  type replies = typeof replies.tsType;
  
  const news = Record({
    title: text,
    description: text,
    id: Principal,
    replies: Vec(replies),
  });
  
  type news = typeof news.tsType;
  
  const channel = Record({
    name: text,
    owner: Principal,
    news: Vec(news),
    followers: Vec(text),
  });
  
  type channel = typeof channel.tsType;
  
  const User = Record({
    id: Principal,
    username: text,
    channelcreated: Vec(text),
    datejoined: nat64,
  });
  
  type User = typeof User.tsType;
  
  //define payloads
  
  const channelPayloads = Record({
    nameofchannel: text,
    username: text,
  });
  
  const newspayload = Record({
    title: text,
    description: text,
    owner: Principal,
    channelname: text,
  });
  
  const replyPayload = Record({
    newsid: Principal,
    reply: text,
    channelname: text,
    username: text,
  });
  
  const userPayload = Record({
    username: text,
  });
  
  const followchannelPayload = Record({
    nameofchannel: text,
    username: text,
  });
  
  const deleteChannelPayload = Record({
    owner: Principal,
    nameofchannel: text,
  });
  
  const getnewsPayload = Record({
    channelname: text,
  });
  //define storages of the new
  
  const channelsstorages = StableBTreeMap<text, channel>(0);
  const usersstorages = StableBTreeMap<text, User>(1);
  const newsstorages = StableBTreeMap<Principal, news>(2);
  //define errors variants
  const Errors = Variant({
    channelDoesNotExist: text,
    channelAlreadyExist: text,
    UserDoesNotExist: text,
    EnterCorrectDetais: text,
    GroupNameIsRequired: text,
    NoMessageWithSuchId: text,
    userNameAlreadyExist: text,
    usernameIsRequired: text,
    credentialsMissing: text,
    onlyOwnerCanDelete: text,
    ErrorWhenExitingGropu: text,
    NotAMemberOfGroup: text,
    AlreadyAmember: text,
  });
  
  type Errors = typeof Errors.tsType;
  
  export default Canister({
    registerUser: update([userPayload], Result(text, Errors), (payload) => {
      if (!payload.username) {
        return Err({ usernameIsRequired: "username is required" });
      }
      //check if username is already taken
      const getUser = usersstorages.get(payload.username);
      if (getUser) {
        return Err({
          userNameAlreadyExist: "username i laready taken try another one",
        });
      }
      //create user
      const createUser: User = {
        id: ic.caller(),
        username: payload.username,
        channelcreated: [],
        datejoined: ic.time(),
      };
      usersstorages.insert(payload.username, createUser);
      return Ok(`user with ${payload.username} has been created successfully`);
    }),
    createchannel: update([channelPayloads], Result(text, Errors), (payload) => {
      if (!payload.nameofchannel || !payload.username) {
        return Err({ credentialsMissing: `channel name is missing` });
      }
      //check if channel name  already exist
      const findChannel = channelsstorages.get(payload.nameofchannel);
      if (findChannel) {
        return Err({
          channelAlreadyExist: `comunity with ${payload.nameofchannel} already exist`,
        });
      }
      //check if user is already registered
      const getUser = usersstorages.get(payload.username);
      if (!getUser) {
        return Err({
          UserDoesNotExist: `user with ${payload.username} is not registered`,
        });
      }
      //create channel
      const idOfOwner = generateId();
      const id = ic.caller();
      const createChannel: channel = {
        owner: id,
        name: payload.nameofchannel,
        news: [],
        followers: [],
      };
  
      channelsstorages.insert(payload.nameofchannel, createChannel);
      //update on user side
      const updateUser: User = {
        ...getUser,
        channelcreated: [...getUser.channelcreated, payload.nameofchannel],
      };
      usersstorages.insert(payload.username, updateUser);
  
      return Ok(`${payload.nameofchannel} channel has been created successfully`);
    }),
  
    //get all available channels
  
    getAllChannels: query([], Vec(channel), () => {
      return channelsstorages.values();
    }),
  
    //follow the channel
    followchannel: update([followchannelPayload], text, (payload) => {
      if (!payload.nameofchannel || !payload.username) {
        return "missing credentials";
      }
      //check if user is already registered
      const getUser = usersstorages.get(payload.username);
      if (!getUser) {
        return `user with given ${payload.username} does not exist`;
      }
      //check if channel already exist
      const getChannel = channelsstorages.get(payload.nameofchannel);
      if (!getChannel) {
        return `${payload.nameofchannel} does not exist`;
      }
  
      //check if user is already following the channel
      const checkUser = getChannel.followers.find(
        (val) => val == payload.username
      );
      if (checkUser) {
        return "already following the channel";
      }
      const updatedChannel: channel = {
        ...getChannel,
        followers: [...getChannel.followers, payload.username],
      };
      channelsstorages.insert(payload.nameofchannel, updatedChannel);
      return `successfully followed ${payload.nameofchannel}`;
    }),
    //unfollow the channel
    unfollowchannel: update([followchannelPayload], text, (payload) => {
      if (!payload.nameofchannel || !payload.username) {
        return "missing credentials";
      }
      //check if user is already registered
      const getUser = usersstorages.get(payload.username);
      if (!getUser) {
        return `user with given ${payload.username} does not exist`;
      }
      //check if channel already exist
      const getChannel = channelsstorages.get(payload.nameofchannel);
      if (!getChannel) {
        return `${payload.nameofchannel} does not exist`;
      }
  
      //check if user is already following the channel
      const checkUser = getChannel.followers.find(
        (val) => val == payload.username
      );
      if (!checkUser) {
        return "not a follower of the channel";
      }
  
      //unfollow the channel
      const updatedChannel: channel = {
        ...getChannel,
        followers: getChannel.followers.filter((val) => payload.username !== val),
      };
      channelsstorages.insert(payload.nameofchannel, updatedChannel);
      return "successfully existed the group";
    }),
  
    //delete channel
    deletechannel: update(
      [deleteChannelPayload],
      Result(text, Errors),
      (payload) => {
        if (!payload.nameofchannel || !payload.owner) {
          return Err({ credentialsMissing: "some credentials are missing" });
        }
        //check if channel  exist
        const checkChannel = channelsstorages.get(payload.nameofchannel);
        if (!checkChannel) {
          return Err({
            channelDoesNotExist: `${payload.nameofchannel} does not exist`,
          });
        }
        //check if its owner performing the action
        if (checkChannel.owner.toText() !== payload.owner.toText()) {
          return Err({
            onlyOwnerCanDelete: "only owner can delete the channel",
          });
        }
        channelsstorages.remove(payload.nameofchannel);
  
        return Ok(`${payload.nameofchannel} has been successufully deleted`);
      }
    ),
  
    //post news
    postnews: update([newspayload], text, (payload) => {
      //verify al details are available
  
      if (
        !payload.description ||
        !payload.title ||
        !payload.owner ||
        !payload.channelname
      ) {
        return "missing credentails";
      }
  
      //check if channel exists
      const checkChannel = channelsstorages.get(payload.channelname);
      if (!checkChannel) {
        return "channel does not exists";
      }
      //check if its owner performing the action
      if (checkChannel.owner.toText() !== payload.owner.toText()) {
        return "only admin is allowd to perform this action";
      }
  
      //create news
      let createnews: news = {
        title: payload.title,
        description: payload.description,
        id: generateId(),
        replies: [],
      };
  
      //add news to the channel
  
      const updatechannel: channel = {
        ...checkChannel,
        news: [...checkChannel.news, createnews],
      };
  
      channelsstorages.insert(payload.channelname, updatechannel);
      return "added news";
    }),
  
    //get news of a channel
  
    get_news: query([getnewsPayload], Result(Vec(news), Errors), (payload) => {
      //check if all details are available
      if (!payload.channelname) {
        return Err({
          credentialsMissing: "some credentails are missing",
        });
      }
  
      return Ok(channelsstorages.get(payload.channelname)?.news);
    }),
  
    //reply to news
    reply_to_news: update([replyPayload], text, (payload) => {
      //check if all parameters are available
  
      if (
        !payload.channelname ||
        !payload.username ||
        !payload.reply ||
        !payload.newsid
      ) {
        return "missing crendentials";
      }
  
      //check if channel exists
      const checkChannel = channelsstorages.get(payload.channelname);
      if (!checkChannel) {
        return "channel does not exists";
      }
      //check if its user is a member of the channel
      const checkUser = checkChannel.followers.find(
        (val) => val == payload.username
      );
  
      if (!checkUser) {
        return "only followers can reply or comment about news";
      }
      //check if newsid is correct
      const checknewsid = checkChannel.news.find(
        (val) => val.id.toText() == payload.newsid.toText()
      );
  
      if (!checknewsid) {
        return "news id is invalid";
      }
      //create a new reply
  
      const new_reply: replies = {
        by: ic.caller(),
        newsid: payload.newsid,
        reply: payload.reply,
      };
  
      //filter nes
      const filteredNews = checkChannel.news.map((item) => {
        if (item.id.toText() === payload.newsid.toText()) {
          return { ...item, replies: [...item.replies, new_reply] };
        }
        return item;
      });
  
      const updatechannel: channel = {
        ...checkChannel,
        news: filteredNews,
      };
      channelsstorages.insert(payload.channelname, updatechannel);
      return "reply sent";
    }),
  });
  
  //helpers function
  
  function generateId(): Principal {
    const randomBytes = new Array(29)
      .fill(0)
      .map((_) => Math.floor(Math.random() * 256));
    return Principal.fromUint8Array(Uint8Array.from(randomBytes));
  }
  