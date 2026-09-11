import express, { Express, Request, Response } from 'express';

// NOT Temporal. Fake third-party API (stand-in for Deepgram / LLM / Stripe).
// Activities in activities.ts call these routes. Run: `npm run service.watch`
//
//   http://localhost:9999/get-spanish-greeting?name=Tina
//   http://localhost:9999/get-spanish-farewell?name=Tina
//   http://localhost:9999/get-spanish-thanks?name=Tina
//
// Stop this process, then `npm run thanks` — the Activity retries until you start it again.

const app: Express = express();
const port = 9999;

app.use('/get-spanish-greeting', (req: Request, res: Response) => {
  if (!req.query.name) {
    res.status(400);
    res.send(
      'Missing required name parameter. Please add ?name=tina to the end of the url.'
    );
    return;
  }

  const name = req.query.name;
  res.status(200);
  res.send(`¡Hola, ${name}!`);
});

app.use('/get-spanish-farewell', (req: Request, res: Response) => {
  if (!req.query.name) {
    res.status(400);
    res.send(
      'Missing required name parameter. Please add ?name=tina to the end of the url.'
    );
    return;
  }

  const name = req.query.name;
  res.status(200);
  res.send(`¡Adiós, ${name}!`);
});

app.use('/get-spanish-thanks', (req: Request, res: Response) => {
  if (!req.query.name) {
    res.status(400);
    res.send(
      'Missing required name parameter. Please add ?name=tina to the end of the url.'
    );
    return;
  }

  const name = req.query.name;
  res.status(200);
  res.send(`¡Gracias, ${name}!`);
});

app.use(notFound);
app.use(errorHandler);

function notFound(req: Request, res: Response) {
  res.status(404);
  res.send({ error: 'Not found!', status: 404, url: req.originalUrl });
}

function errorHandler(err: Error, req: Request, res: Response) {
  console.error('ERROR', err);
  res.status(500);
  res.send({ error: err.message, url: req.originalUrl });
}

app
  .listen(port)
  .on('error', (e) => console.error(e))
  .on('listening', () => console.log(`Listening on http://localhost:${port}`));