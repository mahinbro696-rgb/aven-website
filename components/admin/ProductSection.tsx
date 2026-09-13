"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import ProductManager from "@/components/ProductManager";
import EditProduct from "@/components/admin/EditProduct";



export default function ProductSection(){


const [openAdd,setOpenAdd]=useState(false);


const [tab,setTab]=useState<"add"|"edit">("add");




return(


<div className="relative">





<motion.h1

initial={{
opacity:0,
x:-20
}}

animate={{
opacity:1,
x:0
}}

className="
text-4xl
font-bold
text-yellow-400
mb-8
"

>

Product Management

</motion.h1>









{/* OPTIONS */}



<div className="
grid
md:grid-cols-2
gap-6
">







{/* ADD */}



<motion.button


whileHover={{
scale:1.04
}}


onClick={()=>{


setTab("add");

setOpenAdd(true);


}}


className="
bg-yellow-500
text-black
rounded-3xl
p-8
text-left
shadow-xl
"

>


<div className="
text-6xl
">

➕


</div>




<h2 className="
text-3xl
font-bold
mt-5
">

Add Product

</h2>



<p className="
mt-2
">

Create new luxury collection

</p>



</motion.button>













{/* EDIT */}




<motion.button


whileHover={{
scale:1.04
}}


onClick={()=>setTab("edit")}


className="
bg-zinc-900
border
border-yellow-500/30
rounded-3xl
p-8
text-left
"

>



<div className="
text-6xl
">

✏️

</div>



<h2 className="
text-3xl
font-bold
mt-5
">

Edit Product

</h2>



<p className="
text-gray-400
mt-2
">

Update existing products

</p>



</motion.button>






</div>












{/* EDIT AREA */}




{

tab==="edit" &&


<motion.div


initial={{
opacity:0,
y:30
}}


animate={{
opacity:1,
y:0
}}



className="
mt-8
bg-zinc-900
border
border-yellow-500/20
rounded-3xl
p-8
"


>


<EditProduct/>


</motion.div>



}













{/* ADD POPUP */}




{

openAdd &&



<div className="
fixed
inset-0
z-50
bg-black/80
backdrop-blur-sm
flex
items-center
justify-center
p-5
">





<motion.div


initial={{
scale:0.8,
opacity:0
}}


animate={{
scale:1,
opacity:1
}}



className="
relative
w-full
max-w-4xl
max-h-[90vh]
overflow-y-auto
bg-zinc-950
border
border-yellow-500/30
rounded-3xl
p-8
"


>





<button


onClick={()=>setOpenAdd(false)}


className="
absolute
right-5
top-5
bg-red-600
text-white
w-10
h-10
rounded-full
font-bold
"


>

✕

</button>







<ProductManager/>






</motion.div>






</div>



}




</div>


);



}