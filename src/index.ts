import "dotenv/config";
import { Telegraf, Context } from "telegraf";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const RPC_URL = process.env.RPC_URL;