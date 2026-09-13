"use client";

import { motion } from "framer-motion";


interface Props{

active:string;

setActive:(value:string)=>void;

}



export default function Sidebar({
active,
setActive
}:Props){



const menu=[

{
name:"Dashboard",
icon:"⌂"
},

{
name:"Products",
icon:"✦"
},

{
name:"Orders",
icon:"🛒"
},

{
name:"Settings",
icon:"⚙"
}

];



return(


<motion.aside

initial={{
x:-100,
opacity:0
}}

animate={{
x:0,
opacity:1
}}

className="
w-72
min-h-screen
bg-zinc-950
border-r
border-yellow-500/20
p-6
"


>


<h1 className="
text-4xl
font-bold
text-yellow-400
tracking-widest
mb-10
">

AVEN

</h1>





<div className="space-y-3">


{

menu.map(item=>(


<button


key={item.name}


onClick={()=>setActive(item.name)}



className={`
w-full
flex
items-center
gap-4
p-4
rounded-2xl
transition


${
active===item.name

?

"bg-yellow-500 text-black font-bold"

:

"text-gray-300 hover:bg-zinc-800"

}

`}


>


<span>

{item.icon}

</span>


{item.name}


</button>



))


}


</div>





</motion.aside>


);


}