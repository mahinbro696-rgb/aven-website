"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";


export default function Navbar(){


const [open,setOpen]=useState(false);



return(


<motion.nav

initial={{
opacity:0,
y:-30
}}

animate={{
opacity:1,
y:0
}}

transition={{
duration:.6
}}

className="
fixed
top-5
left-1/2
-translate-x-1/2
z-50
w-[92%]
max-w-7xl
bg-white/5
border
border-white/10
backdrop-blur-xl
rounded-full
px-6
py-4
text-white
shadow-2xl
"


>


<div className="
flex
items-center
justify-between
">





{/* LOGO */}

<Link

href="/"

className="
text-3xl
font-black
tracking-widest
text-yellow-400
"

>

AVEN

</Link>







{/* DESKTOP MENU */}


<div className="
hidden
md:flex
items-center
gap-10
text-sm
font-medium
">


<Link

href="/"

className="
hover:text-yellow-400
transition
"

>

Home

</Link>



<Link

href="/shop"

className="
hover:text-yellow-400
transition
"

>

Collection

</Link>




<Link

href="/about"

className="
hover:text-yellow-400
transition
"

>

About

</Link>




<Link

href="/contact"

className="
hover:text-yellow-400
transition
"

>

Contact

</Link>





</div>









{/* RIGHT SIDE */}



<div className="
flex
items-center
gap-4
">



<button

className="
relative
text-xl
hover:text-yellow-400
transition
"

>

🛒


<span

className="
absolute
-top-2
-right-2
bg-yellow-500
text-black
text-xs
w-5
h-5
rounded-full
flex
items-center
justify-center
"

>

0

</span>


</button>








{/* MOBILE BUTTON */}


<button

onClick={()=>setOpen(!open)}

className="
md:hidden
text-2xl
"

>

{

open
?
"✕"
:
"☰"

}

</button>



</div>



</div>









{/* MOBILE MENU */}


{

open &&


<motion.div

initial={{
opacity:0,
height:0
}}

animate={{
opacity:1,
height:"auto"
}}

className="
md:hidden
mt-5
border-t
border-white/10
pt-5
flex
flex-col
gap-5
"

>


<Link

onClick={()=>setOpen(false)}

href="/"

className="
hover:text-yellow-400
"

>

Home

</Link>



<Link

onClick={()=>setOpen(false)}

href="/shop"

className="
hover:text-yellow-400
"

>

Collection

</Link>



<Link

onClick={()=>setOpen(false)}

href="/about"

className="
hover:text-yellow-400
"

>

About

</Link>



<Link

onClick={()=>setOpen(false)}

href="/contact"

className="
hover:text-yellow-400
"

>

Contact

</Link>



</motion.div>


}



</motion.nav>


);


}