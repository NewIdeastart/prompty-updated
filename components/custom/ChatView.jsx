"use client"
import { MessagesContext } from '@/context/MessagesContext';
import { UserDetailContext } from '@/context/UserDetailContext';
import { api } from '@/convex/_generated/api';
import Colors from '@/data/Colors';
import Lookup from '@/data/Lookup';
import Prompt from '@/data/Prompt';
import axios from 'axios';
import { useConvex, useMutation } from 'convex/react';
import { ArrowRight, Link, Loader2Icon } from 'lucide-react';
import Image from 'next/image';
import { useParams } from 'next/navigation'
import React, { useContext, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useSidebar } from '../ui/sidebar';
import { toast } from 'sonner';

export const countToken = (inputText) => {
  return inputText.trim().split(/\s+/).filter(word => word).length;
};

function ChatView() {
  const { id } = useParams();
  const convex = useConvex();
  const { userDetail, setUserDetail } = useContext(UserDetailContext);
  const { messages, setMessages } = useContext(MessagesContext);
  const [userInput, setUserInput] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const UpdateMessages = useMutation(api.workspace.UpdateMessages);
  const { toggleSidebar } = useSidebar();
  const UpdateTokens = useMutation(api.users.UpdateToken);

  useEffect(() => {
    if (id) {
      GetWorkspaceData();
    }
  }, [id]);

  /**
   * Reads a file as a Base64 data URL
   */
  const readFileAsync = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * Used to Get Workspace data using Workspace ID
   */
  const GetWorkspaceData = async () => {
    const result = await convex.query(api.workspace.GetWorkspace, {
      workspaceId: id
    });
    setMessages(result?.messages);
    console.log(result);
  };

  useEffect(() => {
    if (messages?.length > 0) {
      const lastRole = messages[messages.length - 1].role;
      if (lastRole === 'user') {
        GetAiResponse();
      }
    }
  }, [messages]);

  const GetAiResponse = async () => {
    setLoading(true);
    try {
      let pdfContext = "";
      if (pdfFile) {
        // Read the PDF file and store its content in pdfContext
        pdfContext = await readFileAsync(pdfFile);
      }

      // Prepend PDF context to prompt if available
      const PROMPT = 
        (pdfContext ? `PDF Content: ${pdfContext}\n` : "") + 
        JSON.stringify(messages) + 
        Prompt.CHAT_PROMPT;

      const result = await axios.post('/api/ai-chat', {
        prompt: PROMPT
      });

      const aiResp = {
        role: 'ai',
        content: result.data.result
      };
      setMessages(prev => [...prev, aiResp]);

      await UpdateMessages({
        messages: [...messages, aiResp],
        workspaceId: id
      });

      const token = Number(userDetail?.token) - Number(countToken(JSON.stringify(aiResp)));
      setUserDetail(prev => ({
        ...prev,
        token: token
      }));

      // Update Tokens in Database 
      await UpdateTokens({
        userId: userDetail?._id,
        token: token
      });

      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
      toast('Error generating AI response.');
    }
  };

  const onGenerate = (input) => {
    if (userDetail?.token < 10) {
      toast('You dont have enough token!');
      return;
    }
    setMessages(prev => [
      ...prev,
      {
        role: 'user',
        content: input
      }
    ]);
    setUserInput('');
  };

  return (
    <div className='relative h-[85vh] flex flex-col'>
      <div className='flex-1 overflow-y-scroll scrollbar-hide pl-5 '>
        {messages?.length > 0 && messages.map((msg, index) => (
          <div
            key={index}
            className='p-3 rounded-lg mb-4 flex gap-2 items-center leading-7'
            style={{
              backgroundColor: Colors.CHAT_BACKGROUND
            }}
          >
            {msg?.role === 'user' &&
              <Image 
                src={userDetail?.picture} 
                alt='userImage'
                width={35} 
                height={35} 
                className='rounded-full'
              />
            }
            <ReactMarkdown className='flex flex-col'>
              {msg.content}
            </ReactMarkdown>
          </div>
        ))}
        {loading &&
          <div
            className='p-5 rounded-lg mb-2 flex gap-2 items-center'
            style={{
              backgroundColor: Colors.CHAT_BACKGROUND
            }}
          >
            <Loader2Icon className='animate-spin' />
            <h2>Generating response...</h2>
          </div>
        }
      </div>

      {/* Input Section */}
      <div className='flex gap-2 items-end'>
        {userDetail &&  
          <Image 
            src={userDetail?.picture}
            className='rounded-full cursor-pointer'
            onClick={toggleSidebar}
            alt='user' 
            width={30} 
            height={30}
          />
        }
        <div
          className='p-5 border rounded-xl max-w-xl w-full mt-3'
          style={{
            backgroundColor: Colors.BACKGROUND
          }}
        >
          <div className='flex gap-2 flex-col'>
            <textarea 
              placeholder={Lookup.INPUT_PLACEHOLDER}
              value={userInput}
              onChange={(event) => setUserInput(event.target.value)}
              className='outline-none bg-transparent w-full h-32 max-h-56 resize-none'
            />
            {/* File input for PDF upload */}
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setPdfFile(e.target.files[0]);
                }
              }}
            />
            {userInput && 
              <ArrowRight 
                onClick={() => onGenerate(userInput)}
                className='bg-blue-500 p-2 h-10 w-10 rounded-md cursor-pointer'
              />
            }
          </div>
          <div>
            <Link className='h-5 w-5' />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatView;
