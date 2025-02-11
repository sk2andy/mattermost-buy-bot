import * as dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import "reflect-metadata";
dotenv.config();
import {
  MattermostClient,
  MattermostDialogSubmission,
  MattermostSlashCommandRequest,
} from "./services/mattermost";
import express from "express";
import bodyParser from "body-parser";
import { MattermostPost } from "./services/mattermost/postAction";
import "reflect-metadata";
import { container } from "tsyringe";
import { BuyService } from "./services/buy/buyService";
import { InterestService } from "./services/interest/interestService";

console.log("Create server...");
const buyService = container.resolve(BuyService);
const interestService = container.resolve(InterestService);
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
// app.post("/env", async function (req, res) {
//   res.json(process.env);
// });

app.post(
  "/createbuy",
  async function (req: express.Request, res: express.Response) {
    const command = req.body as MattermostSlashCommandRequest;
    await buyService.startCreationProcess(command);
    res.status(200).send();
  }
);

app.post(
  "/save-buy",
  async function (req: express.Request, res: express.Response) {
    const submission = req.body as MattermostDialogSubmission;
    const stateData: { channel_id: string; buy_id: string } = JSON.parse(
      submission.state as string
    );
    console.log("buyId on save", stateData.buy_id);
    const edit = stateData.buy_id !== undefined;
    const buyId = stateData.buy_id ?? uuidv4();
    await buyService.saveBuy(stateData.channel_id, buyId, submission, edit);
    res.status(200).send();
  }
);

app.post(
  "/edit-buy",
  async function (req: express.Request, res: express.Response) {
    const post = req.body as MattermostPost;
    await buyService.startEditProcess(post);
    res.status(200).send();
  }
);

app.post(
  "/close-buy",
  async function (req: express.Request, res: express.Response) {
    const post = req.body as MattermostPost;
    await buyService.closeBuy(post);
    res.status(200).send();
  }
);

app.post(
  "/close-buy-confirm",
  async function (req: express.Request, res: express.Response) {
    const submission = req.body as MattermostDialogSubmission;
    const stateData: { channel_id: string; buy_id: string } = JSON.parse(
      submission.state.toLowerCase()
    );
    await buyService.confirmCloseBuy(
      submission,
      stateData.channel_id,
      stateData.buy_id
    );

    res.status(200).send();
  }
);

app.post(
  "/interest",
  async function (req: express.Request, res: express.Response) {
    const message = req.body as MattermostPost;
    await interestService.startInterestProcess(message);
    res.status(200).send();
  }
);

app.post(
  "/save-interest",
  async function (req: express.Request, res: express.Response) {
    const submission = req.body as MattermostDialogSubmission;
    await interestService.saveInterest(submission);
    res.json({ text: "Answered" });
  }
);

app.post(
  "/interestlist",
  async function (req: express.Request, res: express.Response) {
    const message = req.body as MattermostPost;
    await interestService.showInterestList(message);
    res.json({ text: "Opened dialog" });
  }
);

app.post(
  "/mark-payed",
  async function (req: express.Request, res: express.Response) {
    const message = req.body as MattermostPost;

    await interestService.markPayed(message);
    res.status(200).send();
  }
);

app.post(
  "/confirm-payment",
  async function (req: express.Request, res: express.Response) {
    const message = req.body as MattermostPost;

    await interestService.confirmPayment(message);
    res.status(200).send();
  }
);

app.post(
  "/reject-payment",
  async function (req: express.Request, res: express.Response) {
    const post = req.body as MattermostPost;
    await interestService.rejectPayment(post);
    res.status(200).send();
  }
);

app.post(
  "/remind-payment",
  async function (req: express.Request, res: express.Response) {
    const message = req.body as MattermostPost;

    await buyService.remindPayment(message);
    res.json({ text: "Reminders sent" });
  }
);

console.log("listen on 8585...");
app.listen(8585, function () {
  console.log("Example app listening on port 8585!");
});
