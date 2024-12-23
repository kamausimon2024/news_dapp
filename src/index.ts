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

// Record definitions
const replies = Record({
  by: Principal,
  newsid: Principal,
  reply: text,
});

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

// Payload definitions
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

// Storage definitions
const channelsstorages = StableBTreeMap<text, channel>(0);
const usersstorages = StableBTreeMap<text, User>(1);
const newsstorages = StableBTreeMap<Principal, news>(2);

// Error variants
const Errors = Variant({
  channelDoesNotExist: text,
  channelAlreadyExist: text,
  UserDoesNotExist: text,
  EnterCorrectDetails: text,
  GroupNameIsRequired: text,
  NoMessageWithSuchId: text,
  userNameAlreadyExist: text,
  usernameIsRequired: text,
  credentialsMissing: text,
  onlyOwnerCanDelete: text,
  ErrorWhenExitingGroup: text,
  NotAMemberOfGroup: text,
  AlreadyAmember: text,
});

type Errors = typeof Errors.tsType;

export default Canister({
  registerUser: update([userPayload], Result(text, Errors), (payload) => {
    if (!payload.username.trim()) {
      return Err({ usernameIsRequired: "Username is required" });
    }

    if (usersstorages.get(payload.username)) {
      return Err({ userNameAlreadyExist: "Username is already taken, try another" });
    }

    const createUser: User = {
      id: ic.caller(),
      username: payload.username,
      channelcreated: [],
      datejoined: ic.time(),
    };

    usersstorages.insert(payload.username, createUser);
    return Ok(`User with username '${payload.username}' has been created successfully`);
  }),

  createchannel: update([channelPayloads], Result(text, Errors), (payload) => {
    if (!payload.nameofchannel.trim() || !payload.username.trim()) {
      return Err({ credentialsMissing: "Channel name or username is missing" });
    }

    if (channelsstorages.get(payload.nameofchannel)) {
      return Err({ channelAlreadyExist: `Channel '${payload.nameofchannel}' already exists` });
    }

    const getUser = usersstorages.get(payload.username);
    if (!getUser) {
      return Err({ UserDoesNotExist: `User '${payload.username}' is not registered` });
    }

    const createChannel: channel = {
      owner: ic.caller(),
      name: payload.nameofchannel,
      news: [],
      followers: [],
    };

    channelsstorages.insert(payload.nameofchannel, createChannel);

    const updatedUser: User = {
      ...getUser,
      channelcreated: [...getUser.channelcreated, payload.nameofchannel],
    };

    usersstorages.insert(payload.username, updatedUser);
    return Ok(`Channel '${payload.nameofchannel}' has been created successfully`);
  }),

  getAllChannels: query([], Vec(channel), () => {
    return channelsstorages.values();
  }),

  followchannel: update([followchannelPayload], Result(text, Errors), (payload) => {
    if (!payload.nameofchannel.trim() || !payload.username.trim()) {
      return Err({ credentialsMissing: "Channel name or username is missing" });
    }

    const getUser = usersstorages.get(payload.username);
    if (!getUser) {
      return Err({ UserDoesNotExist: `User '${payload.username}' does not exist` });
    }

    const getChannel = channelsstorages.get(payload.nameofchannel);
    if (!getChannel) {
      return Err({ channelDoesNotExist: `Channel '${payload.nameofchannel}' does not exist` });
    }

    if (getChannel.followers.includes(payload.username)) {
      return Err({ AlreadyAmember: "User is already following the channel" });
    }

    const updatedChannel: channel = {
      ...getChannel,
      followers: [...getChannel.followers, payload.username],
    };

    channelsstorages.insert(payload.nameofchannel, updatedChannel);
    return Ok(`Successfully followed channel '${payload.nameofchannel}'`);
  }),

  unfollowchannel: update([followchannelPayload], Result(text, Errors), (payload) => {
    if (!payload.nameofchannel.trim() || !payload.username.trim()) {
      return Err({ credentialsMissing: "Channel name or username is missing" });
    }

    const getUser = usersstorages.get(payload.username);
    if (!getUser) {
      return Err({ UserDoesNotExist: `User '${payload.username}' does not exist` });
    }

    const getChannel = channelsstorages.get(payload.nameofchannel);
    if (!getChannel) {
      return Err({ channelDoesNotExist: `Channel '${payload.nameofchannel}' does not exist` });
    }

    if (!getChannel.followers.includes(payload.username)) {
      return Err({ NotAMemberOfGroup: "User is not a follower of the channel" });
    }

    const updatedChannel: channel = {
      ...getChannel,
      followers: getChannel.followers.filter((follower) => follower !== payload.username),
    };

    channelsstorages.insert(payload.nameofchannel, updatedChannel);
    return Ok(`Successfully unfollowed channel '${payload.nameofchannel}'`);
  }),

  deletechannel: update([deleteChannelPayload], Result(text, Errors), (payload) => {
    const checkChannel = channelsstorages.get(payload.nameofchannel);
    if (!checkChannel) {
      return Err({ channelDoesNotExist: `Channel '${payload.nameofchannel}' does not exist` });
    }

    if (checkChannel.owner.toText() !== payload.owner.toText()) {
      return Err({ onlyOwnerCanDelete: "Only the owner can delete the channel" });
    }

    channelsstorages.remove(payload.nameofchannel);

    const user = usersstorages.values().find((u) => u.id.toText() === payload.owner.toText());
    if (user) {
      const updatedUser: User = {
        ...user,
        channelcreated: user.channelcreated.filter((channel) => channel !== payload.nameofchannel),
      };

      usersstorages.insert(user.username, updatedUser);
    }

    return Ok(`Channel '${payload.nameofchannel}' has been successfully deleted`);
  }),
});
