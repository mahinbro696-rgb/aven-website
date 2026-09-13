"use client";

import {useEffect,useState} from "react";
import {motion} from "framer-motion";

import {db} from "@/lib/firebase";

import {
doc,
getDoc,
setDoc
} from "firebase/firestore";



export default function TelegramSettings(){


const [token,setToken]=useState("");

const [chatId,setChatId]=useState("");

const [loading,setLoading]=useState(false);

const [message,setMessage]=useState("");







const loadSettings=async()=>{


const ref=doc(

db,

"settings",

"telegram"

);



const snap=await getDoc(ref);



if(snap.exists()){


const data=snap.data();


setToken(data.botToken || "");

setChatId(data.chatId || "");


}



};








useEffect(()=>{


loadSettings();


},[]);









const saveSettings=async()=>{


try{


setLoading(true);



await setDoc(

doc(

db,

"settings",

"telegram"

),

{


botToken:token,


chatId:chatId


}


);



setMessage(
"Telegram settings saved ✓"
);



}

catch(err){


console.log(err);


setMessage(
"Save failed"
);


}

finally{


setLoading(false);


}



};









const testBot=async()=>{


try{


setLoading(true);



const res=await fetch(

`https://api.telegram.org/bot${token}/sendMessage`,

{


method:"POST",


headers:{

"Content-Type":"application/json"

},


body:JSON.stringify({

chat_id:chatId,

text:
"✅ AVEN Admin Telegram Test Successful"

})


}

);




if(res.ok){


setMessage(
"Test message sent ✓"
);


}

else{


setMessage(
"Telegram error"
);


}



}

catch(error){


console.log(error);


setMessage(
"Test failed"
);


}

finally{


setLoading(false);


}



};









return(


<motion.div


initial={{
opacity:0,
y:20
}}


animate={{
opacity:1,
y:0
}}


className="
bg-zinc-900
border
border-yellow-500/20
rounded-3xl
p-8
max-w-2xl
"


>


<h2 className="
text-3xl
font-bold
text-yellow-400
">

Telegram Control

</h2>



<p className="
text-gray-400
mt-2
mb-8
">

Manage your order notification bot

</p>








<div className="
space-y-5
">



<div>


<label className="
text-yellow-400
font-semibold
">

Bot Token

</label>



<input

value={token}

onChange={(e)=>setToken(e.target.value)}

placeholder="Telegram Bot Token"

className="
aven-input
mt-2
"

/>


</div>







<div>


<label className="
text-yellow-400
font-semibold
">

Chat ID

</label>



<input

value={chatId}

onChange={(e)=>setChatId(e.target.value)}

placeholder="Telegram Chat ID"

className="
aven-input
mt-2
"

/>


</div>









<div className="
flex
gap-4
flex-wrap
">



<button

onClick={saveSettings}

disabled={loading}

className="
bg-yellow-500
text-black
px-6
py-3
rounded-full
font-bold
"


>

Save Settings

</button>







<button

onClick={testBot}

disabled={loading}

className="
bg-green-600
px-6
py-3
rounded-full
font-bold
"


>

Test Bot

</button>




</div>









{

message &&


<p className="
text-yellow-400
mt-5
">

{message}

</p>



}





</div>






</motion.div>


);



}