"use client";

import {useState} from "react";
import Image from "next/image";

import {
db,
storage
} from "@/lib/firebase";


import {
collection,
addDoc,
serverTimestamp
} from "firebase/firestore";


import {
ref,
uploadBytes,
getDownloadURL
} from "firebase/storage";



interface ColorItem{

name:string;

image:File|null;

preview:string;

}



export default function ProductManager(){



const [loading,setLoading]=useState(false);

const [message,setMessage]=useState("");



const [mainImage,setMainImage]=useState<File|null>(null);

const [mainPreview,setMainPreview]=useState("");



const [enableColors,setEnableColors]=useState(false);



const [colors,setColors]=useState<ColorItem[]>([]);





const [form,setForm]=useState({

name:"",

category:"Kushikatha",

oldPrice:"",

discount:"",

price:"",

description:""

});







const handleChange=(e:any)=>{


const {
name,
value
}=e.target;



const updated:any={

...form,

[name]:value

};





if(
name==="oldPrice" ||
name==="discount"
){


const oldPrice=

name==="oldPrice"

?

Number(value)

:

Number(form.oldPrice);



const discount=

name==="discount"

?

Number(value)

:

Number(form.discount);






if(oldPrice && discount){


updated.price=

String(

oldPrice -
(
oldPrice *
discount /
100
)

);


}


}



setForm(updated);


};








const uploadImage=async(file:File)=>{


const imageRef=

ref(

storage,

`products/${Date.now()}-${file.name}`

);



await uploadBytes(

imageRef,

file

);



return await getDownloadURL(

imageRef

);


};









const handleMainImage=(e:any)=>{


const file=e.target.files?.[0];


if(file){


setMainImage(file);


setMainPreview(

URL.createObjectURL(file)

);


}


};









const addColor=()=>{


setColors([

...colors,

{

name:"",

image:null,

preview:""

}

]);


};









const updateColorName=(

index:number,

value:string

)=>{


const copy=[...colors];


copy[index].name=value;


setColors(copy);


};










const updateColorImage=(

index:number,

file:File

)=>{


const copy=[...colors];


copy[index].image=file;


copy[index].preview=

URL.createObjectURL(file);



setColors(copy);


};









const removeColor=(index:number)=>{


setColors(

colors.filter(

(_,i)=>i!==index

)

);


};









const resetForm=()=>{


setForm({

name:"",

category:"Kushikatha",

oldPrice:"",

discount:"",

price:"",

description:""

});


setMainImage(null);

setMainPreview("");

setColors([]);

setEnableColors(false);


};









const publishProduct=async()=>{


if(!mainImage){


alert(
"Main image required"
);


return;


}



try{


setLoading(true);

setMessage("");




const mainURL=

await uploadImage(mainImage);







let colorData:any[]=[];






if(enableColors){


for(
const color of colors
){



if(
color.name &&
color.image
){


const imageURL=

await uploadImage(
color.image
);



colorData.push({

name:color.name,

image:imageURL

});


}



}


}










await addDoc(

collection(
db,
"products"
),

{


name:form.name,


category:form.category,


oldPrice:Number(
form.oldPrice
),


discount:Number(
form.discount
),


price:Number(
form.price
),


description:form.description,


mainImage:mainURL,


colors:colorData,


createdAt:serverTimestamp()


}

);





setMessage(
"Product Published Successfully ✓"
);


resetForm();



}

catch(error){


console.log(error);


setMessage(
"Failed to publish product"
);



}

finally{


setLoading(false);


}


};
return(

<div className="text-white">


<h2 className="
text-3xl
font-bold
text-yellow-400
mb-8
">

Product Studio

</h2>





<div className="
grid
md:grid-cols-2
gap-8
">






{/* MAIN IMAGE */}


<div>


<label className="
text-yellow-400
font-bold
">

Main Product Image

</label>




<div className="
mt-3
h-80
rounded-3xl
border
border-yellow-500/30
bg-black
overflow-hidden
flex
items-center
justify-center
">


{

mainPreview ?


<Image

src={mainPreview}

width={600}

height={600}

alt="main preview"

className="
w-full
h-full
object-cover
"

/>


:


<p className="
text-gray-500
">

No image selected

</p>


}



</div>





<input

type="file"

accept="image/*"

onChange={handleMainImage}

className="
mt-5
text-sm
"

/>



</div>









{/* FORM */}



<div className="
space-y-4
">





<input

name="name"

value={form.name}

onChange={handleChange}

placeholder="Product Name"

className="aven-input"

/>







<select

name="category"

value={form.category}

onChange={handleChange}

className="aven-input"

>


<option>
Kushikatha
</option>


<option>
Jamdani
</option>


<option>
Premium Shawl
</option>


</select>









<input

name="oldPrice"

value={form.oldPrice}

onChange={handleChange}

placeholder="Original Price"

className="aven-input"

/>







<input

name="discount"

value={form.discount}

onChange={handleChange}

placeholder="Discount Percentage"

className="aven-input"

/>







<input

value={form.price}

readOnly

placeholder="Discount Price"

className="
aven-input
bg-zinc-800
"

/>









<textarea

name="description"

value={form.description}

onChange={handleChange}

placeholder="Product Description"

className="
aven-input
h-32
"

/>









{/* COLOR SWITCH */}



<div className="
flex
items-center
gap-3
mt-5
">


<input

type="checkbox"

checked={enableColors}

onChange={(e)=>

setEnableColors(
e.target.checked
)

}

/>


<p>
Enable Multiple Colors
</p>



</div>









{/* COLORS */}


{

enableColors &&


<div className="
mt-5
border
border-yellow-500/20
rounded-3xl
p-5
space-y-5
">



<button

onClick={addColor}

className="
bg-yellow-500
text-black
px-5
py-3
rounded-full
font-bold
"

>

+ Add Color

</button>







{

colors.map((color,index)=>(


<div

key={index}

className="
bg-black
rounded-2xl
p-5
space-y-4
border
border-gray-800
"

>



<input

value={color.name}

placeholder="Color Name"

onChange={(e)=>

updateColorName(
index,
e.target.value
)

}

className="aven-input"

/>







<input

type="file"

accept="image/*"

onChange={(e)=>{


const file=e.target.files?.[0];


if(file){

updateColorImage(
index,
file
);


}



}}


/>









{

color.preview &&


<Image

src={color.preview}

width={150}

height={150}

alt="color"

className="
rounded-xl
object-cover
"

/>


}









<button

onClick={()=>removeColor(index)}

className="
bg-red-600
px-5
py-2
rounded-full
"

>

Remove Color

</button>




</div>



))


}




</div>



}









<button

onClick={publishProduct}

disabled={loading}

className="
w-full
mt-6
bg-yellow-500
text-black
font-bold
py-4
rounded-full
hover:scale-105
transition
"

>


{

loading

?

"Publishing..."

:

"Publish Product"

}



</button>









{

message &&


<p className="
text-center
text-yellow-400
mt-4
">

{message}

</p>


}





</div>







</div>



</div>


);


}