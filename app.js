const { BotFrameworkAdapter, MemoryStorage, ConversationState, MessageFactory, CardFactory, ActionTypes } = require('botbuilder');
const builder = require('botbuilder');
const restify = require('restify');
const botbuilder_dialogs = require('botbuilder-dialogs');

// Create server
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 6195, function () {
    console.log(`${server.name} listening to ${server.url}`);
});

// Create adapter
const adapter = new BotFrameworkAdapter({ 
    appId: process.env.MICROSOFT_APP_ID, 
    appPassword: process.env.MICROSOFT_APP_PASSWORD 
});

// Add conversation state middleware
const conversationState = new ConversationState(new MemoryStorage());
adapter.use(conversationState);


const dialogs = new botbuilder_dialogs.DialogSet("custom");
dialogs.add('namePrompt', new botbuilder_dialogs.TextPrompt());
dialogs.add("firstTitlePrompt", new botbuilder_dialogs.TextPrompt());
dialogs.add("firstDatePrompt", new botbuilder_dialogs.DatetimePrompt( async (context, values) => {
    try {
        if (values.length < 0) { throw new Error('missing time') }
        if (values[0].type !== 'datetime') { throw new Error('unsupported type') }
        const value = new Date(values[0].value);
        if (value.getTime() < new Date().getTime()) { throw new Error('in the past') }
        return value;
    } catch (err) {
        await context.sendActivity(`Please enter a valid time in the future like "tomorrow at 9am".`);
        return undefined;
    }
}));

dialogs.add('NewUserDialog',[
    async function (dc){
        await dc.context.sendActivity("Welcome! TaskBot is used for keeping track of upcoming activities, or whatever you need!");
        await dc.prompt('namePrompt', "Lets get you set up! What is your name?");
    },
    async function(dc,res){
        var name = res;
        await dc.context.sendActivity(`Great! Nice to meet you, ${name}. Now all we need is to teach you the basics.`);
        await dc.prompt('firstTitlePrompt', "We're going to walk you through making your first task! For simplicities sake, what's the first thing that comes to mind?");
    },
    async function (dc,res){
        var firstTitle = res;
        await dc.prompt("firstDatePrompt", `${firstTitle} eh? That works! Now enter a time you'd like to be reminded of this task.`);
    }
])


dialogs.add('choicePrompt', new botbuilder_dialogs.ChoicePrompt());

// Listen for incoming activity 
server.post('/api/messages', (req, res) => {
    // Route received activity to adapter for processing
    adapter.processActivity(req, res, async (context) => {
        const isMessage = context.activity.type === 'message';
        // State will store all of your information
        const convoState = conversationState.get(context);
        const dc = dialogs.createContext(context, convoState);

        
        
        if (isMessage) {
            if (res.response){
                await dc.context.continue();
            }
            if (context.activity.text == "no" || "No" || "N" || "n") {
                return dc.begin('NewUserDialog');
            } 
        }
        else 
        {
            const hero = MessageFactory.attachment(
                CardFactory.heroCard(
                    'Have you used this application before?',
                    [],
                    [{
                        type: ActionTypes.ImBack,
                        title: 'Yes',
                        value: 'Yes'
                    },
                    {
                        type: ActionTypes.ImBack,
                        title: 'No',
                        value: 'No'
                    }]
                )
            );
            await context.sendActivity("This is TaskBot!");
            await context.sendActivity(hero);
        }

        if (!context.responded) {
            await dc.continue();
            // if the dialog didn't send a response
            if (!context.responded && isMessage) {
                await dc.context.sendActivity(`Hi! I'm the add 2 numbers bot. Say something like "What's 2+3?"`);
            }
        }
    });
});
